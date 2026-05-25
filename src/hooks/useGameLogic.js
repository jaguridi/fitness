import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  USERS,
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  MAX_LIVES_PER_WEEK,
  EXTRAS_PER_FINE_REDEMPTION,
  FINE_REDEMPTION_AMOUNT,
  getAvatarForMood,
} from '../constants'
import {
  getUsers,
  setUser,
  getWorkoutsForWeek,
  getAllSummariesForWeek,
  getWeeklySummary,
  setWeeklySummary,
  getAllAbsences,
  updateAbsence,
  subscribeUsers,
  subscribeWorkoutsForWeek,
  getJustificationsForWeek,
  getAppMeta,
  setAppMeta,
} from '../services/firebaseService'
import {
  getWeekId,
  getPreviousWeekId,
  getRecoveryWindow,
} from './useWeekId'

/**
 * Standalone week-end processing logic.
 * Accepts fetched users + absences directly so it can run before React state is ready.
 */

// ── Absence helpers ────────────────────────────────────────────────
//
// Two absence schemas coexist:
//   - Legacy: { frozenWeekId, frozenSessions, recoveryWeeks, missedSessionsPerRecoveryWeek }
//     User picks recovery weeks manually. recoverySessions ADDS to weekly goal.
//   - New:    { frozenWeeks: { [weekId]: count } }
//     Recovery is automatic: extras above WEEKLY_GOAL in ±3 weeks around the
//     freeze range pay down debt (FIFO). Extras consumed for debt don't count
//     toward EXTRA_LIFE_THRESHOLD.
//
// Both formats are filtered/handled wherever absences are inspected.

export function isLegacyAbsence(a) {
  return typeof a.frozenWeekId === 'string'
}

function getFrozenWeeksMap(a) {
  if (a.frozenWeeks && typeof a.frozenWeeks === 'object') return a.frozenWeeks
  if (isLegacyAbsence(a)) {
    const fs = typeof a.frozenSessions === 'number' ? a.frozenSessions : WEEKLY_GOAL
    return { [a.frozenWeekId]: fs }
  }
  return {}
}

function getAbsenceRange(a) {
  const map = getFrozenWeeksMap(a)
  const keys = Object.keys(map).sort()
  if (keys.length === 0) return null
  return { startWeekId: keys[0], endWeekId: keys[keys.length - 1] }
}

export function getAbsenceRecoveryWindow(a) {
  const range = getAbsenceRange(a)
  if (!range) return []
  return getRecoveryWindow(range.startWeekId, range.endWeekId, 3)
}

/**
 * Greedy FIFO simulation: for each user, walks every active new-format absence
 * in createdAt order, and consumes extras (sessions above WEEKLY_GOAL) from
 * non-frozen weeks in the recovery window to pay down debt.
 *
 * Returns:
 *   {
 *     debtConsumedPerAbsenceWeek: { [absenceId]: { [weekId]: number } },
 *     debtConsumedByUserWeek:    { [userId]: { [weekId]: number } },
 *     remainingDebtByAbsence:    { [absenceId]: number },
 *   }
 */
function simulateAutoRecovery(absences, sessionsByUserWeek) {
  const debtConsumedPerAbsenceWeek = {}
  const debtConsumedByUserWeek = {}
  const remainingDebtByAbsence = {}

  const newAbsences = absences
    .filter((a) => !isLegacyAbsence(a) && a.status !== 'closed' && a.frozenWeeks)
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0
      const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0
      return ta - tb
    })

  // Per-week budget of extras already consumed (across absences for the same user/week).
  const extrasConsumedSoFar = {} // `${userId}|${weekId}` → number

  for (const a of newAbsences) {
    const frozenMap = getFrozenWeeksMap(a)
    const totalDebt = Object.values(frozenMap).reduce((s, n) => s + n, 0)
    let remaining = totalDebt
    debtConsumedPerAbsenceWeek[a.id] = {}

    const window = getAbsenceRecoveryWindow(a)
    for (const wk of window) {
      if (remaining <= 0) break
      if (frozenMap[wk] != null) continue // skip the absence's own frozen weeks
      const sessions = sessionsByUserWeek?.[a.userId]?.[wk] || 0
      const totalExtras = Math.max(0, sessions - WEEKLY_GOAL)
      const key = `${a.userId}|${wk}`
      const already = extrasConsumedSoFar[key] || 0
      const available = Math.max(0, totalExtras - already)
      if (available <= 0) continue
      const consume = Math.min(available, remaining)
      remaining -= consume
      debtConsumedPerAbsenceWeek[a.id][wk] = consume
      extrasConsumedSoFar[key] = already + consume
      if (!debtConsumedByUserWeek[a.userId]) debtConsumedByUserWeek[a.userId] = {}
      debtConsumedByUserWeek[a.userId][wk] = (debtConsumedByUserWeek[a.userId][wk] || 0) + consume
    }

    remainingDebtByAbsence[a.id] = remaining
  }

  return { debtConsumedPerAbsenceWeek, debtConsumedByUserWeek, remainingDebtByAbsence }
}

/**
 * Compute the requirements for a user in a given week.
 * Returns { recoverySessions, frozenSessions, totalRequired, fullyFrozen, inRecoveryWindow }
 * - recoverySessions: legacy-only — sessions owed from manually-chosen recovery weeks
 * - frozenSessions: sessions excused from this week (partial freeze allowed)
 * - totalRequired: WEEKLY_GOAL + recovery - frozen (clamped to 0)
 * - fullyFrozen: true when frozenSessions covers the entire (goal+recovery)
 * - inRecoveryWindow: true if any active new-format absence has this week in its ±3 window
 */
function computeWeekRequirements(userId, weekId, absences) {
  // Legacy recovery sessions add to the goal
  const recoverySessions = absences
    .filter((a) => a.userId === userId && isLegacyAbsence(a) && a.recoveryWeeks?.includes(weekId))
    .reduce((sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[weekId] || 0), 0)

  // Sum frozen sessions across both formats
  const frozenSessions = absences
    .filter((a) => a.userId === userId)
    .reduce((sum, a) => sum + (getFrozenWeeksMap(a)[weekId] || 0), 0)

  // Active new-format absence that has this week in its recovery window?
  const inRecoveryWindow = absences.some((a) =>
    a.userId === userId && !isLegacyAbsence(a) && a.status !== 'closed' &&
    getAbsenceRecoveryWindow(a).includes(weekId)
  )

  const baseGoal = WEEKLY_GOAL + recoverySessions
  const fullyFrozen = frozenSessions >= baseGoal
  const totalRequired = Math.max(0, baseGoal - frozenSessions)

  return { recoverySessions, frozenSessions, totalRequired, fullyFrozen, inRecoveryWindow }
}

/**
 * Compute total sessions justified by approved/pending justifications for a user/week.
 * Backwards compat: legacy justifications without sessionsJustified field = WEEKLY_GOAL (full week).
 */
function computeSessionsJustified(userId, weekId, justifications) {
  return justifications
    .filter((j) => j.userId === userId && j.weekId === weekId &&
      (j.aiVerdict === true || j.status === 'pending_vote'))
    .reduce((sum, j) => {
      const sj = typeof j.sessionsJustified === 'number' ? j.sessionsJustified : WEEKLY_GOAL
      return sum + sj
    }, 0)
}

async function fetchSessionsByUserWeek(weekIds) {
  const sessionsByUserWeek = {}
  await Promise.all(weekIds.map(async (wk) => {
    const ws = await getWorkoutsForWeek(wk)
    for (const w of ws) {
      if (!sessionsByUserWeek[w.userId]) sessionsByUserWeek[w.userId] = {}
      sessionsByUserWeek[w.userId][wk] = (sessionsByUserWeek[w.userId][wk] || 0) + 1
    }
  }))
  return sessionsByUserWeek
}

async function runWeekEnd(weekId, fetchedUsers, fetchedAbsences) {
  const weekWorkouts = await getWorkoutsForWeek(weekId)
  const weekJustifications = await getJustificationsForWeek(weekId)

  // Build the simulation up to and including weekId so we know how many
  // extras have been consumed for each new-format absence's debt.
  const simWeeks = new Set([weekId])
  for (const a of fetchedAbsences) {
    if (isLegacyAbsence(a) || a.status === 'closed') continue
    for (const w of getAbsenceRecoveryWindow(a)) {
      if (w <= weekId) simWeeks.add(w)
    }
  }
  const sessionsByUserWeek = await fetchSessionsByUserWeek([...simWeeks])
  const { debtConsumedByUserWeek, remainingDebtByAbsence } =
    simulateAutoRecovery(fetchedAbsences, sessionsByUserWeek)

  // Per-user state updates buffered, so absence settlement below can read the
  // freshest values without a refetch.
  const userStateById = {}
  for (const u of fetchedUsers) userStateById[u.id] = { ...u }

  for (const u of USERS) {
    const user = userStateById[u.id]
    if (!user) continue

    const { recoverySessions, frozenSessions, totalRequired, fullyFrozen } =
      computeWeekRequirements(u.id, weekId, fetchedAbsences)

    if (fullyFrozen) {
      await setWeeklySummary(u.id, weekId, {
        status: 'frozen',
        sessions: 0,
        totalRequired: 0,
        recoverySessions,
        frozenSessions,
        fineApplied: 0,
        lifeUsed: false,
        lifeEarned: false,
      })
      continue
    }

    const sessions = weekWorkouts.filter((w) => w.userId === u.id).length
    const debtConsumed = debtConsumedByUserWeek[u.id]?.[weekId] || 0

    let fineApplied = 0
    let lifeUsed = false
    let lifeEarned = false
    let shieldEarned = false
    let shieldBroken = false
    let newLives = user.extraLives || 0
    let consecutiveMisses = user.consecutiveMisses || 0
    let consecutiveSuccesses = user.consecutiveSuccesses || 0
    let hasShield = user.hasShield || false
    let currentFineLevel = user.currentFineLevel || BASE_FINE

    const deficit = totalRequired - sessions
    const sessionsJustified = computeSessionsJustified(u.id, weekId, weekJustifications)
    const effectiveDeficit = Math.max(0, deficit - sessionsJustified)
    const usedJustification = deficit > 0 && sessionsJustified > 0

    if (deficit <= 0) {
      // Goal met without needing justifications
      currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
      consecutiveMisses = 0
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= 4 && !hasShield) {
        hasShield = true
        shieldEarned = true
      }
      // Extras consumed by an absence's debt don't count toward extra life.
      const regularPlusBonus = sessions - recoverySessions - debtConsumed
      if (regularPlusBonus >= EXTRA_LIFE_THRESHOLD) {
        lifeEarned = true
        newLives += 1
      }
    } else if (effectiveDeficit === 0) {
      // Justifications cover the deficit completely → no fine, but streak resets
      consecutiveSuccesses = 0
    } else if (effectiveDeficit === 1 && newLives > 0) {
      // Use a life to cover the last session
      lifeUsed = true
      newLives -= 1
      currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
      consecutiveMisses = 0
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= 4 && !hasShield) {
        hasShield = true
        shieldEarned = true
      }
    } else {
      // Apply fine
      let baseFine = currentFineLevel
      if (hasShield) {
        baseFine = Math.floor(baseFine / 2)
        hasShield = false
        shieldBroken = true
      }
      fineApplied = baseFine
      consecutiveMisses += 1
      consecutiveSuccesses = 0
      currentFineLevel = Math.min(MAX_FINE, currentFineLevel * 2)
    }

    // ── Extras banking + auto-redemption ──────────────────────────────
    // Bankable extras: sessions above WEEKLY_GOAL that weren't consumed by
    // frozen-week debt. Only earned on weeks the goal was met outright (no
    // extras when a fine was applied or justifications/lives covered a miss).
    const weekExtras = (deficit <= 0)
      ? Math.max(0, (sessions - recoverySessions - debtConsumed) - WEEKLY_GOAL)
      : 0

    let walletBalance = (user.walletBalance || 0) + fineApplied
    let bankedExtras = (user.bankedExtras || 0) + weekExtras

    let extrasRedeemed = 0
    let fineReducedByCanje = 0
    while (bankedExtras >= EXTRAS_PER_FINE_REDEMPTION && walletBalance > 0) {
      const reduction = Math.min(FINE_REDEMPTION_AMOUNT, walletBalance)
      walletBalance -= reduction
      bankedExtras -= EXTRAS_PER_FINE_REDEMPTION
      extrasRedeemed += 1
      fineReducedByCanje += reduction
    }

    userStateById[u.id] = {
      ...user,
      extraLives: newLives,
      walletBalance,
      bankedExtras,
      currentFineLevel,
      consecutiveMisses,
      consecutiveSuccesses,
      hasShield,
    }

    await setUser(u.id, {
      extraLives: newLives,
      walletBalance,
      bankedExtras,
      currentFineLevel,
      consecutiveMisses,
      consecutiveSuccesses,
      hasShield,
    })

    let weekStatus = 'completed'
    if (fineApplied > 0) weekStatus = 'missed'
    else if (usedJustification && deficit > 0) weekStatus = 'justified'

    await setWeeklySummary(u.id, weekId, {
      status: weekStatus,
      sessions,
      totalRequired,
      recoverySessions,
      frozenSessions,
      sessionsJustified,
      fineApplied,
      lifeUsed,
      lifeEarned,
      shieldEarned,
      shieldBroken,
      debtConsumed,
      deficit: Math.max(0, deficit),
      effectiveDeficit,
      extrasBanked: weekExtras,
      extrasRedeemed,
      fineReducedByCanje,
      bankedExtrasAfter: bankedExtras,
    })
  }

  // ── Absence settlement ───────────────────────────────────────────
  // If any new-format absence's recovery window ends on this week and debt
  // remains, apply a proportional fine, escalate, and retroactively mark the
  // frozen weeks as 'missed'.
  for (const a of fetchedAbsences) {
    if (isLegacyAbsence(a) || a.status === 'closed') continue
    const window = getAbsenceRecoveryWindow(a)
    if (window.length === 0 || window[window.length - 1] !== weekId) continue

    const remaining = remainingDebtByAbsence[a.id] || 0
    const frozenMap = getFrozenWeeksMap(a)
    const totalDebt = Object.values(frozenMap).reduce((s, n) => s + n, 0)

    if (remaining > 0) {
      const user = userStateById[a.userId]
      if (user) {
        const fineLevel = user.currentFineLevel || BASE_FINE
        const fine = Math.min(MAX_FINE, Math.round((fineLevel * remaining) / WEEKLY_GOAL))
        const updatedUser = {
          ...user,
          walletBalance: (user.walletBalance || 0) + fine,
          currentFineLevel: Math.min(MAX_FINE, fineLevel * 2),
          consecutiveMisses: (user.consecutiveMisses || 0) + 1,
          consecutiveSuccesses: 0,
        }
        userStateById[a.userId] = updatedUser
        await setUser(a.userId, {
          walletBalance: updatedUser.walletBalance,
          currentFineLevel: updatedUser.currentFineLevel,
          consecutiveMisses: updatedUser.consecutiveMisses,
          consecutiveSuccesses: 0,
        })

        // Mark the frozen weeks as 'missed' so history reflects the penalty.
        const frozenWeekIds = Object.keys(frozenMap)
        const finePerWeek = Math.round(fine / Math.max(1, frozenWeekIds.length))
        for (let i = 0; i < frozenWeekIds.length; i++) {
          const fwk = frozenWeekIds[i]
          const share = i === frozenWeekIds.length - 1
            ? fine - finePerWeek * (frozenWeekIds.length - 1)
            : finePerWeek
          await setWeeklySummary(a.userId, fwk, {
            status: 'missed',
            fineApplied: share,
            frozenSessions: frozenMap[fwk] || 0,
            debtUnpaid: remaining,
          })
        }

        await updateAbsence(a.id, {
          status: 'closed',
          debtUnpaid: remaining,
          totalDebt,
          fineApplied: fine,
          closedAt: new Date().toISOString(),
        })
      }
    } else {
      await updateAbsence(a.id, {
        status: 'closed',
        debtUnpaid: 0,
        totalDebt,
        fineApplied: 0,
        closedAt: new Date().toISOString(),
      })
    }
  }
}

/**
 * useGameLogic – The core hook that calculates fines, extra lives,
 * and weekly statuses for all users.
 */
export default function useGameLogic() {
  const [users, setUsersState] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [summaries, setSummaries] = useState([])
  const [absences, setAbsences] = useState([])
  // Session counts for past weeks that fall inside an active absence's
  // recovery window — used by the auto-recovery simulation to know how
  // much debt has already been paid before the current week.
  const [pastSessionsByUserWeek, setPastSessionsByUserWeek] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalPot, setTotalPot] = useState(0)

  const currentWeekId = getWeekId()

  // ── Load & subscribe data ──────────────────────────────────
  useEffect(() => {
    let unsubUsers, unsubWorkouts, timeoutId

    async function init() {
      setLoading(true)
      setError(null)

      // Safety timeout: if init takes > 15s, stop loading and show error
      timeoutId = setTimeout(() => {
        setLoading(false)
        setError('Tiempo de espera agotado. Revisa tu conexión o la configuración de Firebase.')
      }, 15000)

      try {
        // Ensure all 4 users exist in Firestore and sync name/avatar
        const existing = await getUsers()
        for (const u of USERS) {
          const found = existing.find((e) => e.id === u.id)
          if (!found) {
            await setUser(u.id, {
              name: u.name,
              avatar: u.avatar,
              walletBalance: 0,
              extraLives: 0,
              currentFineLevel: BASE_FINE,
              consecutiveMisses: 0,
              consecutiveSuccesses: 0,
              hasShield: false,
              bankedExtras: 0,
            })
          } else if (found.name !== u.name || found.avatar !== u.avatar) {
            // Always sync name/avatar from constants
            await setUser(u.id, { name: u.name, avatar: u.avatar })
          }
        }

        // Load absences
        const abs = await getAllAbsences()
        setAbsences(abs)

        // Auto week-end processing: catch up every unprocessed week up to prevWeekId.
        // The lock advances ONLY after each week succeeds so a failure can be
        // retried on the next session instead of being silently skipped.
        try {
          const prevWeekId = getPreviousWeekId(currentWeekId)
          const meta = await getAppMeta()
          const lastProcessed = meta.lastAutoProcessedWeekId

          // Walk back from prevWeekId until we hit lastProcessed, building the queue.
          const pending = []
          let cursor = prevWeekId
          for (let i = 0; i < 52 && cursor && cursor !== lastProcessed; i++) {
            pending.unshift(cursor)
            cursor = getPreviousWeekId(cursor)
          }

          // Fresh install (no lock yet) or unreachable lock: only process prevWeekId
          // to avoid retroactively fining users on initial setup.
          const weeksToProcess = (lastProcessed && cursor === lastProcessed)
            ? pending
            : (prevWeekId ? [prevWeekId] : [])

          let usersForRun = existing
          let absForRun = abs
          for (const wk of weeksToProcess) {
            await runWeekEnd(wk, usersForRun, absForRun)
            await setAppMeta({ lastAutoProcessedWeekId: wk })
            // Refetch so the next iteration sees updated walletBalance / lives /
            // closed absences from settlement.
            usersForRun = await getUsers()
            absForRun = await getAllAbsences()
          }
          setAbsences(absForRun)
        } catch (autoErr) {
          console.error('Auto week-end processing failed:', autoErr)
        }

        // Subscribe to real-time updates (with error handlers)
        unsubUsers = subscribeUsers(
          (data) => setUsersState(data),
          (err) => console.error('Users subscription error:', err),
        )
        unsubWorkouts = subscribeWorkoutsForWeek(
          currentWeekId,
          (data) => setWorkouts(data),
          (err) => console.error('Workouts subscription error:', err),
        )

        // Load current week summaries
        const sums = await getAllSummariesForWeek(currentWeekId)
        setSummaries(sums)
      } catch (err) {
        console.error('Error initializing game data:', err)
        setError(err.message || 'Error conectando con la base de datos')
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    init()

    return () => {
      clearTimeout(timeoutId)
      unsubUsers?.()
      unsubWorkouts?.()
    }
  }, [currentWeekId])

  // ── Calculate total pot from all user wallets ──────────────
  useEffect(() => {
    const total = users.reduce((sum, u) => sum + (u.walletBalance || 0), 0)
    setTotalPot(total)
  }, [users])

  // ── Fetch past-week session counts inside active recovery windows ──
  // The current week is excluded here (it comes from the live `workouts`
  // subscription). Re-runs whenever absences change so newly-created or
  // edited absences pull in any historical sessions they need.
  useEffect(() => {
    let cancelled = false
    const weeksNeeded = new Set()
    for (const a of absences) {
      if (isLegacyAbsence(a) || a.status === 'closed') continue
      for (const wk of getAbsenceRecoveryWindow(a)) {
        if (wk !== currentWeekId) weeksNeeded.add(wk)
      }
    }
    if (weeksNeeded.size === 0) {
      setPastSessionsByUserWeek({})
      return
    }
    fetchSessionsByUserWeek([...weeksNeeded])
      .then((data) => { if (!cancelled) setPastSessionsByUserWeek(data) })
      .catch((err) => console.error('past sessions fetch error:', err))
    return () => { cancelled = true }
  }, [absences, currentWeekId])

  const refreshAbsences = useCallback(async () => {
    const fresh = await getAllAbsences()
    setAbsences(fresh)
  }, [])

  // ── Get workout count for a user in the current week ───────
  const getSessionCount = useCallback(
    (userId) => {
      return workouts.filter((w) => w.userId === userId).length
    },
    [workouts]
  )

  // ── Live auto-recovery simulation ──────────────────────────
  // Combines historical session counts (pastSessionsByUserWeek) with the
  // live current-week workout count to compute, per user, how many extras
  // are being consumed by ongoing absence debt.
  const liveRecovery = useMemo(() => {
    const sessionsByUserWeek = {}
    for (const [uid, m] of Object.entries(pastSessionsByUserWeek)) {
      sessionsByUserWeek[uid] = { ...m }
    }
    for (const u of users) {
      const count = workouts.filter((w) => w.userId === u.id).length
      if (!sessionsByUserWeek[u.id]) sessionsByUserWeek[u.id] = {}
      sessionsByUserWeek[u.id][currentWeekId] = count
    }
    return simulateAutoRecovery(absences, sessionsByUserWeek)
  }, [absences, pastSessionsByUserWeek, workouts, users, currentWeekId])

  // ── Get recovery sessions owed for this week ───────────────
  const getRecoverySessions = useCallback(
    (userId) => {
      return computeWeekRequirements(userId, currentWeekId, absences).recoverySessions
    },
    [absences, currentWeekId]
  )

  // ── Get frozen sessions for this week (partial freezing supported) ──
  const getFrozenSessions = useCallback(
    (userId) => {
      return computeWeekRequirements(userId, currentWeekId, absences).frozenSessions
    },
    [absences, currentWeekId]
  )

  // ── Check if week is fully frozen (no sessions required) ──────────
  const isWeekFrozen = useCallback(
    (userId) => {
      return computeWeekRequirements(userId, currentWeekId, absences).fullyFrozen
    },
    [absences, currentWeekId]
  )

  // ── Calculate user status for the current week ─────────────
  const getUserWeekStatus = useCallback(
    (userId) => {
      const userFirestore = users.find((u) => u.id === userId)
      if (!userFirestore) return null

      // Compute mood-based avatar
      const userConst = USERS.find((u) => u.id === userId)
      const moodAvatar = getAvatarForMood(userConst, userFirestore)
      const user = { ...userFirestore, avatar: moodAvatar }

      const sessions = getSessionCount(userId)
      const { recoverySessions, frozenSessions, totalRequired, fullyFrozen, inRecoveryWindow } =
        computeWeekRequirements(userId, currentWeekId, absences)
      const regularSessions = Math.min(sessions, WEEKLY_GOAL)
      const debtConsumedThisWeek = liveRecovery.debtConsumedByUserWeek[userId]?.[currentWeekId] || 0
      const bonusSessions = Math.max(0, sessions - WEEKLY_GOAL - recoverySessions - debtConsumedThisWeek)

      // Outstanding debt across all active new-format absences for this user.
      const remainingDebt = absences
        .filter((a) => a.userId === userId && !isLegacyAbsence(a) && a.status !== 'closed')
        .reduce((sum, a) => sum + (liveRecovery.remainingDebtByAbsence[a.id] || 0), 0)

      const goalMet = sessions >= totalRequired
      const bankedExtras = user.bankedExtras || 0
      // What the bank will look like after this week's close, assuming the
      // user keeps meeting the goal. Lets the UI preview the canje progress.
      const bankedExtrasProjected = bankedExtras + (goalMet ? bonusSessions : 0)

      return {
        userId,
        user,
        sessions,
        totalRequired,
        regularSessions,
        recoverySessions,
        frozenSessions,
        bonusSessions,
        frozen: fullyFrozen,
        partiallyFrozen: !fullyFrozen && frozenSessions > 0,
        goalMet,
        progress: totalRequired > 0 ? Math.min(1, sessions / totalRequired) : 1,
        // Extras consumed by debt repayment don't count toward the extra life.
        canEarnLife:
          !fullyFrozen &&
          sessions - debtConsumedThisWeek >= EXTRA_LIFE_THRESHOLD + recoverySessions,
        inRecoveryWindow,
        debtConsumedThisWeek,
        remainingDebt,
        bankedExtras,
        bankedExtrasProjected,
      }
    },
    [users, getSessionCount, absences, currentWeekId, liveRecovery]
  )

  // ── Process end-of-week (manual fallback in Admin) ──────────
  const processWeekEnd = useCallback(
    async (weekId = currentWeekId) => {
      await runWeekEnd(weekId, users, absences)
    },
    [users, absences, currentWeekId]
  )

  // Compute mood-based avatars for all users
  const usersWithMood = users.map((u) => {
    const userConst = USERS.find((c) => c.id === u.id)
    return { ...u, avatar: getAvatarForMood(userConst, u) }
  })

  return {
    users: usersWithMood,
    workouts,
    summaries,
    absences,
    loading,
    error,
    totalPot,
    currentWeekId,
    getSessionCount,
    getRecoverySessions,
    getFrozenSessions,
    isWeekFrozen,
    getUserWeekStatus,
    processWeekEnd,
    refreshAbsences,
  }
}

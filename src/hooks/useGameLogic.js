import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  USERS,
  WEEKLY_GOAL,
  BASE_FINE,
  EXTRA_LIFE_THRESHOLD,
  getAvatarForMood,
} from '../constants'
import {
  isLegacyAbsence,
  getAbsenceRecoveryWindow,
  simulateAutoRecovery,
  computeWeekRequirements,
} from '../game/absences.js'
import { computeWeekEndOutcome, getSimulationWeeks } from '../game/weekEnd.js'
import {
  getUsers,
  setUser,
  getWorkoutsForWeek,
  getAllSummariesForWeek,
  setWeeklySummary,
  getAllAbsences,
  updateAbsence,
  subscribeUsers,
  subscribeWorkoutsForWeek,
  getJustificationsForWeek,
  getAppMeta,
  claimWeekProcessing,
  completeWeekProcessing,
} from '../services/firebaseService'
import { getWeekId, getPreviousWeekId } from './useWeekId'

export { isLegacyAbsence, getAbsenceRecoveryWindow }

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

/**
 * Fetch inputs, run the pure week-end computation (src/game/weekEnd.js), and
 * apply the resulting writes to Firestore in order.
 */
async function runWeekEnd(weekId, fetchedUsers, fetchedAbsences) {
  const weekWorkouts = await getWorkoutsForWeek(weekId)
  const weekJustifications = await getJustificationsForWeek(weekId)
  const sessionsByUserWeek = await fetchSessionsByUserWeek(
    getSimulationWeeks(weekId, fetchedAbsences)
  )

  const { userUpdates, summaries, absenceUpdates } = computeWeekEndOutcome({
    weekId,
    userIds: USERS.map((u) => u.id),
    users: fetchedUsers,
    absences: fetchedAbsences,
    weekWorkouts,
    weekJustifications,
    sessionsByUserWeek,
  })

  for (const { userId, data } of userUpdates) {
    await setUser(userId, data)
  }
  for (const { userId, weekId: wk, data } of summaries) {
    await setWeeklySummary(userId, wk, data)
  }
  for (const { absenceId, data } of absenceUpdates) {
    await updateAbsence(absenceId, data)
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
        // Each week is claimed via a Firestore transaction first, so two devices
        // opening the app at the same time can't both apply the same fines. The
        // scheduled Cloud Function does the same dance server-side; whoever claims
        // first wins, the other skips. The lock advances ONLY after each week
        // succeeds so a failure can be retried on the next session.
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
            const claimed = await claimWeekProcessing(wk)
            // Another device (or the Cloud Function) owns this week — later
            // weeks depend on its result, so stop here and let the next app
            // load pick up from wherever the lock landed.
            if (!claimed) break
            await runWeekEnd(wk, usersForRun, absForRun)
            await completeWeekProcessing(wk)
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
      for (const wk of getAbsenceRecoveryWindow(a, absences)) {
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

      // Active recovery weeks still ahead (this week included) before the debt's
      // window closes. The window already excludes frozen weeks, so this counts
      // only the real chances left to pay down the debt with extras.
      const recoveryWeeksLeft = (() => {
        if (remainingDebt <= 0) return 0
        const weeks = new Set()
        for (const a of absences) {
          if (a.userId !== userId || isLegacyAbsence(a) || a.status === 'closed') continue
          if ((liveRecovery.remainingDebtByAbsence[a.id] || 0) <= 0) continue
          for (const wk of getAbsenceRecoveryWindow(a, absences)) {
            if (wk >= currentWeekId) weeks.add(wk)
          }
        }
        return weeks.size
      })()

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
        recoveryWeeksLeft,
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

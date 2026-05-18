import { useState, useEffect, useCallback } from 'react'
import {
  USERS,
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  MAX_LIVES_PER_WEEK,
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
  subscribeUsers,
  subscribeWorkoutsForWeek,
  getJustificationsForWeek,
  getAppMeta,
  setAppMeta,
} from '../services/firebaseService'
import { getWeekId, getPreviousWeekId } from './useWeekId'

/**
 * Standalone week-end processing logic.
 * Accepts fetched users + absences directly so it can run before React state is ready.
 */
/**
 * Compute the requirements for a user in a given week.
 * Returns { recoverySessions, frozenSessions, totalRequired, fullyFrozen }
 * - recoverySessions: sessions owed from previous frozen weeks
 * - frozenSessions: sessions excused from this week (partial freeze allowed)
 * - totalRequired: WEEKLY_GOAL + recovery - frozen (clamped to 0)
 * - fullyFrozen: true when frozenSessions covers the entire (goal+recovery)
 */
function computeWeekRequirements(userId, weekId, absences) {
  const recoverySessions = absences
    .filter((a) => a.userId === userId && a.recoveryWeeks?.includes(weekId))
    .reduce((sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[weekId] || 0), 0)

  // Sum frozen sessions from any absence that targets this week
  const frozenSessions = absences
    .filter((a) => a.userId === userId && a.frozenWeekId === weekId)
    .reduce((sum, a) => {
      // Backwards compat: legacy absences without frozenSessions = full WEEKLY_GOAL
      const fs = typeof a.frozenSessions === 'number' ? a.frozenSessions : WEEKLY_GOAL
      return sum + fs
    }, 0)

  const baseGoal = WEEKLY_GOAL + recoverySessions
  const fullyFrozen = frozenSessions >= baseGoal
  const totalRequired = Math.max(0, baseGoal - frozenSessions)

  return { recoverySessions, frozenSessions, totalRequired, fullyFrozen }
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

async function runWeekEnd(weekId, fetchedUsers, fetchedAbsences) {
  const weekWorkouts = await getWorkoutsForWeek(weekId)
  const weekJustifications = await getJustificationsForWeek(weekId)

  for (const u of USERS) {
    const user = fetchedUsers.find((usr) => usr.id === u.id)
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
      const regularPlusBonus = sessions - recoverySessions
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

    await setUser(u.id, {
      extraLives: newLives,
      walletBalance: (user.walletBalance || 0) + fineApplied,
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
      deficit: Math.max(0, deficit),
      effectiveDeficit,
    })
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
          for (const wk of weeksToProcess) {
            await runWeekEnd(wk, usersForRun, abs)
            await setAppMeta({ lastAutoProcessedWeekId: wk })
            // Refetch so the next iteration sees updated walletBalance / lives / etc.
            usersForRun = await getUsers()
          }
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

  // ── Get workout count for a user in the current week ───────
  const getSessionCount = useCallback(
    (userId) => {
      return workouts.filter((w) => w.userId === userId).length
    },
    [workouts]
  )

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
      const { recoverySessions, frozenSessions, totalRequired, fullyFrozen } =
        computeWeekRequirements(userId, currentWeekId, absences)
      const regularSessions = Math.min(sessions, WEEKLY_GOAL)
      const bonusSessions = Math.max(0, sessions - WEEKLY_GOAL - recoverySessions)

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
        goalMet: sessions >= totalRequired,
        progress: totalRequired > 0 ? Math.min(1, sessions / totalRequired) : 1,
        canEarnLife: !fullyFrozen && sessions >= EXTRA_LIFE_THRESHOLD + recoverySessions,
      }
    },
    [users, getSessionCount, absences, currentWeekId]
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
  }
}

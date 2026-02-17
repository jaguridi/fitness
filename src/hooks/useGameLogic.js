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
} from '../services/firebaseService'
import { getWeekId, getPreviousWeekId } from './useWeekId'

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
      const userAbsences = absences.filter(
        (a) =>
          a.userId === userId &&
          a.recoveryWeeks?.includes(currentWeekId)
      )
      return userAbsences.reduce(
        (sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[currentWeekId] || 0),
        0
      )
    },
    [absences, currentWeekId]
  )

  // ── Check if week is frozen (planned absence) ──────────────
  const isWeekFrozen = useCallback(
    (userId) => {
      return absences.some(
        (a) => a.userId === userId && a.frozenWeekId === currentWeekId
      )
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
      const recoverySessions = getRecoverySessions(userId)
      const frozen = isWeekFrozen(userId)
      const totalRequired = frozen ? 0 : WEEKLY_GOAL + recoverySessions
      const regularSessions = Math.min(sessions, WEEKLY_GOAL)
      const bonusSessions = Math.max(0, sessions - WEEKLY_GOAL - recoverySessions)

      return {
        userId,
        user,
        sessions,
        totalRequired,
        regularSessions,
        recoverySessions,
        bonusSessions,
        frozen,
        goalMet: sessions >= totalRequired,
        progress: totalRequired > 0 ? Math.min(1, sessions / totalRequired) : 1,
        canEarnLife: !frozen && sessions >= EXTRA_LIFE_THRESHOLD + recoverySessions,
      }
    },
    [users, getSessionCount, getRecoverySessions, isWeekFrozen]
  )

  // ── Process end-of-week (to be called manually or via a cron) ──
  const processWeekEnd = useCallback(
    async (weekId = currentWeekId) => {
      const weekWorkouts = await getWorkoutsForWeek(weekId)
      const weekJustifications = await getJustificationsForWeek(weekId)
      const prevWeekId = getPreviousWeekId(weekId)

      for (const u of USERS) {
        const user = users.find((usr) => usr.id === u.id)
        if (!user) continue

        const frozen = absences.some(
          (a) => a.userId === u.id && a.frozenWeekId === weekId
        )

        if (frozen) {
          await setWeeklySummary(u.id, weekId, {
            status: 'frozen',
            sessions: 0,
            fineApplied: 0,
            lifeUsed: false,
            lifeEarned: false,
          })
          continue
        }

        const sessions = weekWorkouts.filter((w) => w.userId === u.id).length
        const recoverySessions = absences
          .filter(
            (a) =>
              a.userId === u.id && a.recoveryWeeks?.includes(weekId)
          )
          .reduce(
            (sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[weekId] || 0),
            0
          )
        const totalRequired = WEEKLY_GOAL + recoverySessions

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

        if (deficit <= 0) {
          // Goal met! Reduce fine level
          currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
          consecutiveMisses = 0
          consecutiveSuccesses += 1

          // Check for shield: 4 consecutive successful weeks (only if no shield yet)
          if (consecutiveSuccesses >= 4 && !hasShield) {
            hasShield = true
            shieldEarned = true
            // Don't reset consecutiveSuccesses — shield stays until broken
          }

          // Check for extra life (only regular sessions count, not recovery)
          const regularPlusBonus = sessions - recoverySessions
          if (regularPlusBonus >= EXTRA_LIFE_THRESHOLD) {
            lifeEarned = true
            newLives += 1
          }
        } else if (deficit === 1 && newLives > 0) {
          // Use an extra life
          lifeUsed = true
          newLives -= 1
          currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
          consecutiveMisses = 0
          consecutiveSuccesses += 1

          // Life used counts as success for shield streak
          if (consecutiveSuccesses >= 4 && !hasShield) {
            hasShield = true
            shieldEarned = true
          }
        } else {
          // Check if user has an accepted justification for this week
          const justification = weekJustifications.find(
            (j) => j.userId === u.id && j.aiVerdict === true
          )

          if (justification) {
            // Justified: freeze — no fine, but doesn't count as success
            // Fine level stays the same, streak resets
            consecutiveSuccesses = 0
            // Don't increase consecutiveMisses — it's justified
          } else {
            // Missed without valid justification! Apply fine
            let baseFine = currentFineLevel

            // Shield: pay half, shield breaks
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
        }

        // Update user profile
        await setUser(u.id, {
          extraLives: newLives,
          walletBalance: (user.walletBalance || 0) + fineApplied,
          currentFineLevel,
          consecutiveMisses,
          consecutiveSuccesses,
          hasShield,
        })

        // Determine status
        const justifiedThisWeek = weekJustifications.find(
          (j) => j.userId === u.id && j.aiVerdict === true
        )
        let weekStatus = 'completed'
        if (fineApplied > 0) weekStatus = 'missed'
        else if (justifiedThisWeek && deficit > 0) weekStatus = 'justified'

        // Save weekly summary
        await setWeeklySummary(u.id, weekId, {
          status: weekStatus,
          sessions,
          totalRequired,
          recoverySessions,
          fineApplied,
          lifeUsed,
          lifeEarned,
          shieldEarned,
          shieldBroken,
          deficit: Math.max(0, deficit),
        })
      }
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
    isWeekFrozen,
    getUserWeekStatus,
    processWeekEnd,
  }
}

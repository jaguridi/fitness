import { useState, useEffect, useCallback } from 'react'
import {
  USERS,
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  MAX_LIVES_PER_WEEK,
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
        // Ensure all 4 users exist in Firestore
        const existing = await getUsers()
        for (const u of USERS) {
          if (!existing.find((e) => e.id === u.id)) {
            await setUser(u.id, {
              name: u.name,
              avatar: u.avatar,
              walletBalance: 0,
              extraLives: 0,
              currentFineLevel: BASE_FINE,
              consecutiveMisses: 0,
            })
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
      const user = users.find((u) => u.id === userId)
      if (!user) return null

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
        let newLives = user.extraLives || 0
        let consecutiveMisses = user.consecutiveMisses || 0
        let currentFineLevel = user.currentFineLevel || BASE_FINE

        const deficit = totalRequired - sessions

        if (deficit <= 0) {
          // Goal met! Reduce fine level
          currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
          consecutiveMisses = 0

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
        } else {
          // Missed! Apply fine
          fineApplied = currentFineLevel
          consecutiveMisses += 1
          currentFineLevel = Math.min(MAX_FINE, currentFineLevel * 2)
        }

        // Update user profile
        await setUser(u.id, {
          extraLives: newLives,
          walletBalance: (user.walletBalance || 0) + fineApplied,
          currentFineLevel,
          consecutiveMisses,
        })

        // Save weekly summary
        await setWeeklySummary(u.id, weekId, {
          status: fineApplied > 0 ? 'missed' : 'completed',
          sessions,
          totalRequired,
          recoverySessions,
          fineApplied,
          lifeUsed,
          lifeEarned,
          deficit: Math.max(0, deficit),
        })
      }
    },
    [users, absences, currentWeekId]
  )

  return {
    users,
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

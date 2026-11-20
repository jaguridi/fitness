/**
 * The single family data store. Subscribes once (only while logged in) to
 * users, workouts, weekly_summaries, habits, habit_weeks, achievement_unlocks,
 * week_posts and goals; everything else is derived with ./selectors.js.
 *
 * Must be rendered inside <AuthProvider>.
 *
 * useFamily() → {
 *   ready, error, weekId, today, members, workouts, summaries, habits,
 *   habitWeeks, unlocks, weekPosts, goals, customSports, state, backendKind,
 *   isDemo, isReadonly, actions
 * }
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { USERS } from '../constants.js'
import { DEFAULT_WEEKLY_GOAL, MIN_WEEKLY_GOAL, MAX_WEEKLY_GOAL } from '../game/constants.js'
import { getWeekId, getNextWeekId } from '../game/weekId.js'
import { todayYMD, weekIdOfDate, getHabitChecks } from '../game/habits.js'
import { getAchievementDef } from '../domain/achievements.js'
import { getBackend, IS_DEMO, IS_READONLY } from './index.js'
import { runClientWeekClose, parkV1Lock } from './weekClose.js'
import {
  mergeMembers, findTarget, getMemberWeek, getFamilyWeek, getHabitProgress, getAchievements,
  getAlbumSummary, getMemberStats, buildFeed, getUnlockPlan, getGoals, getGoalView,
} from './selectors.js'

const FamilyContext = createContext(null)

const INIT_TIMEOUT_MS = 15000
const TIMEOUT_MESSAGE = 'Tiempo de espera agotado. Revisa tu conexión e inténtalo de nuevo.'

// Collection key → backend subscribe method. All must report before `ready`.
const SUBSCRIPTIONS = {
  users: 'subscribeUsers',
  workouts: 'subscribeWorkouts',
  summaries: 'subscribeSummaries',
  habits: 'subscribeHabits',
  habitWeeks: 'subscribeHabitWeeks',
  unlocks: 'subscribeUnlocks',
  weekPosts: 'subscribeWeekPosts',
  goals: 'subscribeGoals',
}

const EMPTY = { users: [], workouts: [], summaries: [], habits: [], habitWeeks: [], unlocks: [], weekPosts: [], goals: [], customSports: [] }

const readClock = () => {
  const now = new Date()
  return { today: todayYMD(now), weekId: getWeekId(now) }
}

const clampGoal = (g) => Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(Number(g)) || DEFAULT_WEEKLY_GOAL))
const clampTarget = (t) => Math.min(7, Math.max(1, Math.round(Number(t)) || 7))

/** Create missing users docs (no fines fields) and keep name/avatar in sync with USERS. */
async function ensureUserDocs(backend) {
  const existing = await backend.getUsers()
  for (const u of USERS) {
    const found = existing.find((e) => e.id === u.id)
    if (!found) {
      await backend.setUser(u.id, {
        name: u.name, avatar: u.avatar, weeklyGoal: DEFAULT_WEEKLY_GOAL, restWeeks: [], prefs: { habitReminder: true },
      })
    } else if (found.name !== u.name || found.avatar !== u.avatar) {
      await backend.setUser(u.id, { name: u.name, avatar: u.avatar })
    }
  }
}

export function FamilyDataProvider({ children }) {
  const { currentUser, isLoggedIn } = useAuth()
  const userId = currentUser?.id || null

  const [clock, setClock] = useState(readClock)
  const [raw, setRaw] = useState(EMPTY)
  const [received, setReceived] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [backend, setBackend] = useState(null)
  const readyRef = useRef(false)

  // ── Day / week rollover ──
  useEffect(() => {
    const refresh = () => setClock((prev) => {
      const next = readClock()
      return next.today === prev.today && next.weekId === prev.weekId ? prev : next
    })
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const id = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // ── Subscriptions (only while logged in) ──
  useEffect(() => {
    if (!isLoggedIn) {
      setRaw(EMPTY)
      setReceived(new Set())
      setError(null)
      return undefined
    }
    let cancelled = false
    const unsubs = []
    setError(null)
    // Only a load that is STILL pending after the timeout is an error; once the
    // data arrived this must stay silent (readyRef is updated on every render).
    const timeoutId = setTimeout(() => {
      if (!cancelled && !readyRef.current) setError(TIMEOUT_MESSAGE)
    }, INIT_TIMEOUT_MS)
    const markReceived = (key) => setReceived((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

    ;(async () => {
      try {
        const b = await getBackend()
        if (cancelled) return
        setBackend(b)
        await ensureUserDocs(b)
        // v1 fines kill-switch (no-op in read-only; in memory in demo).
        await parkV1Lock(b).catch((err) => console.error('parkV1FinesLock failed:', err))
        if (cancelled) return
        for (const [key, method] of Object.entries(SUBSCRIPTIONS)) {
          unsubs.push(b[method](
            (list) => {
              if (cancelled) return
              setRaw((prev) => ({ ...prev, [key]: list }))
              markReceived(key)
            },
            (err) => { if (!cancelled) setError(err?.message || 'Error leyendo datos de la familia') },
          ))
        }
        unsubs.push(b.subscribeCustomSports((list) => { if (!cancelled) setRaw((prev) => ({ ...prev, customSports: list })) }))
      } catch (err) {
        console.error('Error initializing family data:', err)
        if (!cancelled) setError(err?.message || 'Error conectando con la base de datos')
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      for (const u of unsubs) u?.()
    }
  }, [isLoggedIn])

  const ready = isLoggedIn && Object.keys(SUBSCRIPTIONS).every((k) => received.has(k))
  readyRef.current = ready
  useEffect(() => { if (ready) setError((e) => (e === TIMEOUT_MESSAGE ? null : e)) }, [ready])

  const members = useMemo(() => mergeMembers(raw.users), [raw.users])

  /** @type {import('./selectors.js').FamilyState} */
  const state = useMemo(() => ({
    weekId: clock.weekId,
    today: clock.today,
    members,
    workouts: raw.workouts,
    summaries: raw.summaries,
    habits: raw.habits,
    habitWeeks: raw.habitWeeks,
    unlocks: raw.unlocks,
    weekPosts: raw.weekPosts,
    goals: raw.goals,
  }), [clock, members, raw])

  const stateRef = useRef(state)
  stateRef.current = state

  // ── Client fallback week close (once per week per session) ──
  const closedFor = useRef(null)
  useEffect(() => {
    if (!ready || !backend || closedFor.current === clock.weekId) return
    closedFor.current = clock.weekId
    const s = stateRef.current
    runClientWeekClose(backend, {
      currentWeekId: clock.weekId,
      users: s.members,
      workouts: s.workouts,
      habits: s.habits,
      habitWeeks: s.habitWeeks,
      summaries: s.summaries,
      goals: s.goals,
    }).catch((err) => console.error('Client week close failed:', err))
  }, [ready, backend, clock.weekId])

  // ── Mark the current user's goals achieved once they reach the target ──
  // Only the owner's client records it, once per goal per session (the
  // backend transition is also a no-op unless the goal is still 'active').
  const achievedMarked = useRef(new Set())
  useEffect(() => {
    if (!ready || !backend || !userId) return
    for (const g of state.goals) {
      if (g.userId !== userId || achievedMarked.current.has(g.id)) continue
      if (!getGoalView(state, g).needsAchievedMark) continue
      achievedMarked.current.add(g.id)
      backend.markGoalAchieved(g.id).catch((err) => {
        console.error('markGoalAchieved failed:', err)
        achievedMarked.current.delete(g.id)
      })
    }
  }, [ready, backend, userId, state])

  // ── Actions ──
  const need = useCallback(() => {
    if (!backend) throw new Error('Los datos aún no están listos.')
    if (!userId) throw new Error('Inicia sesión primero.')
    return backend
  }, [backend, userId])

  const actions = useMemo(() => ({
    /**
     * Log a workout for the current user. The photo is mandatory: pass the
     * `photo` File (uploaded first) or an already uploaded `photoURL`.
     * @param {{ date: string, exerciseType: string|string[], duration: number, calories?: number,
     *   description?: string, photo?: File|null, photoURL?: string }} input
     * @returns {Promise<{ id: string, photoURL: string }>}
     */
    logWorkout: ({ date, exerciseType, duration, calories, description, photo = null, photoURL }) => {
      const b = need()
      if (!photo && !photoURL) return Promise.reject(new Error('La foto es obligatoria.'))
      const cal = Number(calories)
      const workout = {
        userId,
        date,
        weekId: weekIdOfDate(date),
        exerciseType: Array.isArray(exerciseType) ? exerciseType : [exerciseType].filter(Boolean),
        duration: Number(duration),
        description: (description || '').trim(),
        ...(cal > 0 ? { calories: Math.round(cal) } : {}),
        ...(photoURL ? { photoURL } : {}),
      }
      return b.addWorkout(workout, photo)
    },
    /** @param {string} workoutId @param {object} updates duration|calories|description|exerciseType|photoURL */
    updateWorkout: (workoutId, updates) => need().updateWorkout(workoutId, updates),
    deleteWorkout: (workoutId) => need().deleteWorkout(workoutId),
    /** Upload a photo for the current user; resolves its URL. */
    uploadWorkoutPhoto: (file, date) => need().uploadWorkoutPhoto(file, userId, date),

    /** Toggle the current user's reaction: same emoji removes it, another replaces it. */
    react: (target, emoji) => {
      const b = need()
      const current = findTarget(stateRef.current, target)?.reactions?.[userId]
      return b.setReaction(target, userId, current === emoji ? null : emoji)
    },
    /** Comment on a target. Empty text is ignored. */
    comment: (target, text) => {
      const b = need()
      if (!String(text || '').trim()) return Promise.resolve(null)
      return b.addComment(target, userId, text)
    },

    /**
     * Create (no id) or edit a habit of the current user.
     * @param {{ id?: string, name: string, emoji?: string, targetPerWeek: number,
     *   visibility?: 'family'|'private' }} habit
     * @returns {Promise<string>} habit id
     */
    saveHabit: (habit) => {
      const b = need()
      const payload = { ...habit }
      if ('targetPerWeek' in payload) payload.targetPerWeek = clampTarget(payload.targetPerWeek)
      if (!habit.id) {
        const mine = stateRef.current.habits.filter((h) => h.userId === userId)
        payload.userId = userId
        payload.order = mine.reduce((m, h) => Math.max(m, (h.order ?? 0) + 1), 0)
      }
      return b.saveHabit(payload)
    },
    archiveHabit: (habitId, archived = true) => need().archiveHabit(habitId, archived),
    /** @param {string[]} orderedIds the current user's habit ids in the new order */
    reorderHabits: (orderedIds) => need().reorderHabits(orderedIds),
    /** Toggle a habit for a date (default today). Only today and earlier days of this week. */
    toggleHabitCheck: (habitId, date = stateRef.current.today) => {
      const b = need()
      const s = stateRef.current
      const weekId = weekIdOfDate(date)
      if (weekId !== s.weekId || date > s.today) {
        return Promise.reject(new Error('Solo puedes marcar hoy o días anteriores de esta semana.'))
      }
      const hw = s.habitWeeks.find((x) => x.userId === userId && x.weekId === weekId)
      const on = !getHabitChecks(hw, habitId).includes(date)
      return b.toggleHabitCheck(userId, weekId, habitId, date, on)
    },

    /**
     * Create (no id) or edit a personal goal of the current user.
     * @param {{ id?: string, title: string, emoji?: string, kind: 'auto'|'manual',
     *   metric?: 'sessions'|'minutes'|'calories'|'habit', exerciseType?: string, habitId?: string,
     *   target: number, unit?: string, progress?: number, startDate: string, endDate: string,
     *   reward?: string, visibility?: 'family'|'private' }} goal
     * @returns {Promise<string>} goal id
     */
    saveGoal: (goal) => {
      const b = need()
      if (!goal.id && (!goal.title || !goal.startDate || !goal.endDate || !(Number(goal.target) > 0))) {
        return Promise.reject(new Error('Falta el título, el objetivo o las fechas de la meta.'))
      }
      if (goal.startDate && goal.endDate && goal.endDate < goal.startDate) {
        return Promise.reject(new Error('La fecha de término debe ser posterior a la de inicio.'))
      }
      const payload = { ...goal }
      if ('target' in payload) payload.target = Number(payload.target)
      if (!goal.id) payload.userId = userId
      return b.saveGoal(payload)
    },
    /** Update the progress of one of the current user's manual goals. */
    updateGoalProgress: (goalId, progress) => need().updateGoalProgress(goalId, progress),
    /** Cancel one of the current user's goals. */
    cancelGoal: (goalId) => need().cancelGoal(goalId),

    /** Set the current user's weekly goal (clamped to 1–7). */
    setWeeklyGoal: (goal) => need().setUser(userId, { weeklyGoal: clampGoal(goal) }),
    /** Mark/unmark a rest week (only the current or the next week). */
    setRestWeek: (weekId, on) => {
      const b = need()
      const s = stateRef.current
      if (weekId !== s.weekId && weekId !== getNextWeekId(s.weekId)) {
        return Promise.reject(new Error('Solo puedes marcar como descanso esta semana o la siguiente.'))
      }
      return b.setRestWeek(userId, weekId, !!on)
    },
    /** Merge into users/{me}.prefs (e.g. { habitReminder: false }). */
    updatePrefs: (prefs) => need().setUser(userId, { prefs }),

    /** Record a newly earned sticker (posts it to the feed). Resolves false if already recorded. */
    recordUnlock: (achievementId) => {
      const def = getAchievementDef(achievementId)
      if (!def) return Promise.reject(new Error(`Lámina desconocida: ${achievementId}`))
      return need().recordUnlock(userId, def)
    },
    /** Silently register historical stickers and stamp v2SeededAt. Resolves how many were created. */
    seedUnlocks: (achievementIds) => need().seedUnlocks(userId, achievementIds.map(getAchievementDef).filter(Boolean)),

    /** Push an "empujón" to another member (30-min cooldown). */
    sendNudge: (targetUserId) => need().sendNudge(targetUserId, currentUser?.name || 'Alguien'),
    /** Minutes left before the current user can nudge targetUserId again (0 = now). */
    nudgeCooldownMinutes: (targetUserId) => (backend?.nudgeCooldownMinutes ? backend.nudgeCooldownMinutes(targetUserId) : 0),
    /** Ask for notification permission and store the token. Resolves the token or null. */
    registerPush: () => need().registerPush(userId),
    getWeeklyRecap: (weekId) => need().getWeeklyRecap(weekId),
    getMonthlyRecap: (monthId) => need().getMonthlyRecap(monthId),
    addCustomSport: (name) => need().addCustomSport(name),
  }), [need, userId, currentUser, backend])

  const value = useMemo(() => ({
    ready,
    error,
    weekId: clock.weekId,
    today: clock.today,
    members,
    workouts: raw.workouts,
    summaries: raw.summaries,
    habits: raw.habits,
    habitWeeks: raw.habitWeeks,
    unlocks: raw.unlocks,
    weekPosts: raw.weekPosts,
    goals: raw.goals,
    customSports: raw.customSports,
    state,
    backendKind: IS_DEMO ? 'demo' : IS_READONLY ? 'readonly' : 'firebase',
    isDemo: IS_DEMO,
    isReadonly: IS_READONLY,
    actions,
  }), [ready, error, clock, members, raw, state, actions])

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

/** The family store. Must be used inside <FamilyDataProvider>. */
export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within FamilyDataProvider')
  return ctx
}

// ── Convenience hooks (memoized selectors) ──────────────────

/** getMemberWeek for a member (default: the current week). */
export function useMemberWeek(userId, weekId) {
  const { state } = useFamily()
  return useMemo(() => getMemberWeek(state, userId, weekId || state.weekId), [state, userId, weekId])
}

/** getFamilyWeek (default: the current week). */
export function useFamilyWeek(weekId) {
  const { state } = useFamily()
  return useMemo(() => getFamilyWeek(state, weekId || state.weekId), [state, weekId])
}

/** getHabitProgress with the logged-in user as viewer. */
export function useHabitProgress(userId, { weekId, includeArchived = false } = {}) {
  const { state } = useFamily()
  const { currentUser } = useAuth()
  const viewerId = currentUser?.id
  return useMemo(
    () => getHabitProgress(state, userId, { weekId: weekId || state.weekId, viewerId, includeArchived }),
    [state, userId, weekId, viewerId, includeArchived],
  )
}

/** getAchievements for a member. */
export function useAchievements(userId) {
  const { state } = useFamily()
  return useMemo(() => getAchievements(state, userId), [state, userId])
}

/** getAlbumSummary for a member. */
export function useAlbumSummary(userId) {
  const { state } = useFamily()
  return useMemo(() => getAlbumSummary(state, userId), [state, userId])
}

/** getUnlockPlan for a member (meaningful once `ready`). */
export function useUnlockPlan(userId) {
  const { state, ready } = useFamily()
  return useMemo(() => (ready ? getUnlockPlan(state, userId) : { needsSeed: false, pending: [] }), [state, ready, userId])
}

/** getMemberStats for a member. */
export function useMemberStats(userId, { weeks = 12 } = {}) {
  const { state } = useFamily()
  return useMemo(() => getMemberStats(state, userId, { weeks }), [state, userId, weeks])
}

/** getGoals for a member with the logged-in user as viewer. */
export function useGoals(userId, { includeCancelled = false } = {}) {
  const { state } = useFamily()
  const { currentUser } = useAuth()
  const viewerId = currentUser?.id
  return useMemo(() => getGoals(state, userId, { viewerId, includeCancelled }), [state, userId, viewerId, includeCancelled])
}

/** buildFeed with the logged-in user as viewer. */
export function useFeed({ limit = 50, userId } = {}) {
  const { state } = useFamily()
  const { currentUser } = useAuth()
  const viewerId = currentUser?.id
  return useMemo(() => buildFeed(state, { limit, viewerId, userId }), [state, limit, viewerId, userId])
}

export default FamilyContext

/**
 * Backend selection.
 *
 *   vite --mode demo      (VITE_DEMO=1)      → backend.demo.js (in memory, fake data)
 *   vite --mode readonly  (VITE_READONLY=1)  → backend.firebase.js, every write a no-op
 *   default                                  → backend.firebase.js
 *
 * Both backends are loaded with a dynamic import: the demo seed never lands in
 * the production main chunk, and Firebase is never initialised in demo mode
 * (Vite replaces import.meta.env.VITE_DEMO at build time, so the unused branch
 * is dropped).
 *
 * @typedef {{ kind: 'workout'|'unlock'|'weekPost'|'goal', id: string }} Target
 *
 * @typedef {object} Backend
 * @property {'firebase'|'readonly'|'demo'} kind
 * Subscriptions — each `(cb(list), onError?) => unsubscribe`; docs are `{ id, ...data }`:
 * @property {Function} subscribeUsers
 * @property {Function} subscribeWorkouts      all workouts, newest first
 * @property {Function} subscribeSummaries     all weekly_summaries
 * @property {Function} subscribeHabits        all habits (by order)
 * @property {Function} subscribeHabitWeeks    all habit_weeks
 * @property {Function} subscribeUnlocks       all achievement_unlocks
 * @property {Function} subscribeWeekPosts     all week_posts
 * @property {Function} subscribeGoals         all goals
 * @property {Function} subscribeCustomSports  cb(string[])
 * Users:
 * @property {() => Promise<object[]>} getUsers
 * @property {(userId: string) => Promise<object|null>} getUser
 * @property {(userId: string, data: object, opts?: { remove?: string[] }) => Promise<void>} setUser  merge
 * @property {(userId: string, weekId: string, on: boolean) => Promise<void>} setRestWeek
 * @property {(userId: string, token: string) => Promise<void>} addFcmToken
 * Workouts:
 * @property {(file: File, userId: string, date: string) => Promise<string>} uploadWorkoutPhoto  → URL
 * @property {(workout: object, photoFile?: File|null) => Promise<{ id: string, photoURL: string }>} addWorkout  photo mandatory (file or workout.photoURL)
 * @property {(id: string, updates: object) => Promise<void>} updateWorkout  duration|calories|description|exerciseType|photoURL
 * @property {(id: string) => Promise<void>} deleteWorkout
 * Social (on any Target):
 * @property {(target: Target, userId: string, emoji: string|null) => Promise<void>} setReaction  null removes
 * @property {(target: Target, userId: string, text: string) => Promise<object>} addComment  → { userId, text, createdAt }
 * Habits:
 * @property {(habit: object) => Promise<string>} saveHabit  create (no id) or update → id
 * @property {(habitId: string, archived?: boolean) => Promise<void>} archiveHabit
 * @property {(orderedIds: string[]) => Promise<void>} reorderHabits
 * @property {(userId: string, weekId: string, habitId: string, date: string, on: boolean) => Promise<void>} toggleHabitCheck
 * Goals:
 * @property {(goal: object) => Promise<string>} saveGoal  create (no id, status 'active') or edit → id
 * @property {(goalId: string, progress: number) => Promise<void>} updateGoalProgress  manual goals
 * @property {(goalId: string) => Promise<boolean>} markGoalAchieved  status+achievedAt, only if still active
 * @property {(goalId: string) => Promise<boolean>} markGoalMissed    only if still active (week close)
 * @property {(goalId: string) => Promise<void>} cancelGoal
 * Stickers:
 * @property {(userId: string, def: object) => Promise<boolean>} recordUnlock  false if it already existed
 * @property {(userId: string, defs: object[]) => Promise<number>} seedUnlocks  silent, seeded: true; sets v2SeededAt
 * Week close:
 * @property {(userId: string, weekId: string, data: object) => Promise<void>} setWeeklySummary
 * @property {(weekId: string, data: object) => Promise<void>} setWeekPost  merge, never touches reactions/comments
 * @property {() => Promise<object>} getAppMeta
 * @property {(weekId: string) => Promise<boolean>} claimWeekProcessing  v2 lock: v2LastClosedWeekId/v2Processing
 * @property {(weekId: string) => Promise<void>} completeWeekProcessing  sets v2LastClosedWeekId
 * @property {() => Promise<boolean>} parkV1FinesLock  lastAutoProcessedWeekId → '9999-W99' (keeps old in v1LastProcessedWeekId)
 * Misc:
 * @property {(name: string) => Promise<void>} addCustomSport
 * @property {(targetUserId: string) => number} nudgeCooldownMinutes  0 = can nudge
 * @property {(targetUserId: string, senderName: string) => Promise<object>} sendNudge  throws on cooldown
 * @property {(weekId: string) => Promise<object>} getWeeklyRecap   { weekId, recap, … }
 * @property {(monthId: string) => Promise<object>} getMonthlyRecap { monthId, recap, … }
 * @property {(userId: string) => Promise<string|null>} registerPush
 * @property {(cb: Function) => Promise<Function>} onForegroundMessage
 */

export const IS_DEMO = import.meta.env.VITE_DEMO === '1'
export const IS_READONLY = !IS_DEMO && import.meta.env.VITE_READONLY === '1'

let backendPromise = null

/**
 * The active backend (loaded once, cached).
 * @returns {Promise<Backend>}
 */
export function getBackend() {
  if (!backendPromise) {
    backendPromise = (IS_DEMO
      ? import('./backend.demo.js').then((m) => m.default)
      : import('./backend.firebase.js')
    ).catch((err) => {
      backendPromise = null
      throw err
    })
  }
  return backendPromise
}

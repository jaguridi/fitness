// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// v2 weekly state and week close — shared between the web client and Cloud
// Functions. IMPORTANT: no imports outside src/game/ (copied verbatim to
// functions/game/ by scripts/sync-game.mjs).
//
// Rules (plan §3): each member has a weeklyGoal (1–7, default 3). A week is
// 'completed' when sessions ≥ goal, 'rest' when the member marked it as a rest
// week (and didn't reach the goal anyway), otherwise 'missed' once closed.
// No fines, no balances: the close only produces weekly_summaries, a
// week_posts doc and 'missed' marks for expired personal goals, and is a pure
// function of its inputs (idempotent).

import { DEFAULT_WEEKLY_GOAL, MIN_WEEKLY_GOAL, MAX_WEEKLY_GOAL } from './constants.js'
import { weekIdOfDate, weekdayIndex, weekDates, summarizeHabitWeek } from './habits.js'
import { getWeeklyStreak } from './streaks.js'
import { findExpiredGoals } from './goals.js'

/** A user's weekly goal, clamped to 1–7 (default 3). */
export function getWeeklyGoal(user) {
  const g = Math.round(Number(user?.weeklyGoal))
  if (!Number.isFinite(g) || g <= 0) return DEFAULT_WEEKLY_GOAL
  return Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, g))
}

/** True when the user marked `weekId` as a rest week. */
export function isRestWeek(user, weekId) {
  return Array.isArray(user?.restWeeks) && user.restWeeks.includes(weekId)
}

/** weekId a workout belongs to (stored weekId, falling back to its date). */
export function workoutWeekId(w) {
  return w?.weekId || (w?.date ? weekIdOfDate(w.date) : null)
}

/**
 * One member's state for one week.
 *
 * @param {object} p
 * @param {{ id: string, weeklyGoal?: number, restWeeks?: string[] }} p.user
 * @param {string} p.weekId
 * @param {object[]} p.workouts  any workouts (filtered here by user + week)
 * @param {string} [p.currentWeekId]  the live week; weeks before it are closed
 * @param {boolean} [p.closed]  force closed/open (overrides currentWeekId)
 * @param {string} [p.today]  'yyyy-MM-dd', used for daysLeft
 * @returns {{
 *   userId: string, weekId: string, sessions: number, goal: number,
 *   minutes: number, calories: number, rest: boolean, met: boolean,
 *   closed: boolean,
 *   status: 'completed'|'missed'|'rest'|'in_progress',
 *   remaining: number,  // sessions still needed (0 when met or resting)
 *   extras: number,     // sessions above the goal
 *   progress: number,   // 0..1 towards the goal (0 when resting and nothing logged)
 *   daysTrained: boolean[], // Mon..Sun
 *   daysLeft: number,   // days left in the week including today (0 once closed)
 *   workouts: object[], // this member's workouts that week, oldest first
 * }}
 */
export function computeMemberWeek({ user, weekId, workouts, currentWeekId, closed, today }) {
  const userId = user?.id
  const mine = (workouts || [])
    .filter((w) => (!userId || w.userId === userId) && workoutWeekId(w) === weekId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const sessions = mine.length
  const minutes = mine.reduce((s, w) => s + (Number(w.duration) || 0), 0)
  const calories = mine.reduce((s, w) => s + (Number(w.calories) || 0), 0)
  const goal = getWeeklyGoal(user)
  const rest = isRestWeek(user, weekId)
  const met = sessions >= goal
  const isClosed = typeof closed === 'boolean' ? closed : (currentWeekId ? weekId < currentWeekId : false)

  let status
  if (met) status = 'completed'
  else if (rest) status = 'rest'
  else status = isClosed ? 'missed' : 'in_progress'

  const daysTrained = Array(7).fill(false)
  for (const w of mine) if (w.date) daysTrained[weekdayIndex(w.date)] = true

  let daysLeft = 0
  if (!isClosed) {
    const dates = weekDates(weekId)
    if (today && today >= dates[0] && today <= dates[6]) daysLeft = 7 - weekdayIndex(today)
    else if (!today || today < dates[0]) daysLeft = 7
  }

  return {
    userId,
    weekId,
    sessions,
    goal,
    minutes,
    calories,
    rest,
    met,
    closed: isClosed,
    status,
    remaining: met || rest ? 0 : goal - sessions,
    extras: Math.max(0, sessions - goal),
    progress: goal > 0 ? Math.min(1, sessions / goal) : 1,
    daysTrained,
    daysLeft,
    workouts: mine,
  }
}

/**
 * The v2 week close: per-member weekly_summaries + the family week_posts doc.
 *
 * Pure and deterministic: same inputs → same outputs, no timestamps (the
 * writer adds createdAt/updatedAt). Re-running it for a week overwrites the
 * same docs with the same data.
 *
 * @param {object} p
 * @param {string} p.weekId                 week being closed
 * @param {string[]} p.userIds              members, in display order
 * @param {object[]} p.users                users docs ({ id, weeklyGoal, restWeeks, … })
 * @param {object[]} p.workouts             workouts (at least those of weekId)
 * @param {object[]} [p.habits]             all habits docs
 * @param {object[]} [p.habitWeeks]         habit_weeks docs (at least those of weekId)
 * @param {object[]} [p.summaries]          existing weekly_summaries (history, for the streak)
 * @param {object[]} [p.goals]              all goals docs (expired active ones get marked missed)
 * @returns {{
 *   summaries: Array<{ userId, weekId, data: {
 *     userId, weekId, v: 2, status: 'completed'|'missed'|'rest',
 *     sessions, goal, totalRequired, minutes,
 *     habits: { total, met, items: [{ habitId, name, emoji, done, target }] } } }>,
 *   weekPost: { weekId, data: { weekId, v: 2, results: [{ userId, status,
 *     sessions, goal, streak, habitsMet, habitsTotal }] } },
 *   goalUpdates: Array<{ goalId, data: { status: 'missed' } }>
 * }}
 */
export function computeWeekClose({ weekId, userIds, users, workouts, habits = [], habitWeeks = [], summaries = [], goals = [] }) {
  const out = []
  const results = []
  for (const userId of userIds) {
    const user = (users || []).find((u) => u.id === userId) || { id: userId }
    const week = computeMemberWeek({ user, weekId, workouts, closed: true })
    const status = week.status // completed | rest | missed (closed weeks never 'in_progress')

    const habitWeek = (habitWeeks || []).find((hw) => hw.userId === userId && hw.weekId === weekId) || null
    const userHabits = (habits || []).filter((h) => h.userId === userId)
    const hs = summarizeHabitWeek(userHabits, habitWeek, weekId, { visibility: 'family' })

    const data = {
      userId,
      weekId,
      v: 2,
      status,
      sessions: week.sessions,
      goal: week.goal,
      totalRequired: week.goal,
      minutes: week.minutes,
      habits: {
        total: hs.total,
        met: hs.met,
        items: hs.items.map(({ habitId, name, emoji, done, target }) => ({ habitId, name, emoji, done, target })),
      },
    }
    out.push({ userId, weekId, data })

    const history = (summaries || []).filter((s) => s.userId === userId && s.weekId !== weekId)
    const streak = getWeeklyStreak([...history, data], { throughWeekId: weekId })
    results.push({
      userId,
      status,
      sessions: week.sessions,
      goal: week.goal,
      streak,
      habitsMet: hs.met,
      habitsTotal: hs.total,
    })
  }
  const sunday = weekDates(weekId)[6]
  const goalUpdates = findExpiredGoals(goals, { workouts, habitWeeks, throughDate: sunday })
    .map((g) => ({ goalId: g.id, data: { status: 'missed' } }))
  return { summaries: out, weekPost: { weekId, data: { weekId, v: 2, results } }, goalUpdates }
}

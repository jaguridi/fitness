// Personal goals ("metas personales") — shared between the web client and
// Cloud Functions. IMPORTANT: no imports outside src/game/ (copied verbatim to
// functions/game/ by scripts/sync-game.mjs).
//
// goals/{id}: { userId, title, emoji, kind: 'auto'|'manual',
//   metric: 'sessions'|'minutes'|'calories'|'habit' (auto only),
//   exerciseType?, habitId?, target, unit? (manual), progress? (manual),
//   startDate, endDate ('yyyy-MM-dd'), reward?, visibility, status, achievedAt?, createdAt }

import { diffDaysYMD, getHabitChecks, parseYMD } from './habits.js'

export const GOAL_METRICS = ['sessions', 'minutes', 'calories', 'habit']
export const GOAL_STATUSES = ['active', 'achieved', 'missed', 'cancelled']

function workoutHasType(w, type) {
  if (!type) return true
  const list = Array.isArray(w?.exerciseType) ? w.exerciseType : w?.exerciseType ? [w.exerciseType] : []
  return list.includes(type)
}

const inRange = (date, goal) => !!date && date >= goal.startDate && date <= goal.endDate

/**
 * Progress of a goal.
 * - manual: `goal.progress` towards `goal.target`.
 * - auto sessions|minutes|calories: the owner's workouts dated within
 *   [startDate, endDate], optionally only those including `exerciseType`.
 * - auto habit: distinct days checked for `habitId` within the range.
 * @param {object} goal
 * @param {{ workouts?: object[], habitWeeks?: object[] }} data  (any users; filtered by goal.userId)
 * @returns {{ current: number, target: number, ratio: number, done: boolean }}
 */
export function computeGoalProgress(goal, { workouts = [], habitWeeks = [] } = {}) {
  const target = Math.max(0, Number(goal?.target) || 0)
  let current = 0
  if (goal?.kind === 'manual') {
    current = Math.max(0, Number(goal.progress) || 0)
  } else if (goal?.metric === 'habit') {
    const days = new Set()
    for (const hw of habitWeeks) {
      if (goal.userId && hw.userId && hw.userId !== goal.userId) continue
      for (const d of getHabitChecks(hw, goal.habitId)) if (inRange(d, goal)) days.add(d)
    }
    current = days.size
  } else {
    const mine = workouts.filter((w) => (!goal.userId || w.userId === goal.userId) && inRange(w.date, goal) && workoutHasType(w, goal.exerciseType))
    if (goal.metric === 'minutes') current = mine.reduce((s, w) => s + (Number(w.duration) || 0), 0)
    else if (goal.metric === 'calories') current = mine.reduce((s, w) => s + (Number(w.calories) || 0), 0)
    else current = mine.length
  }
  return { current, target, ratio: target > 0 ? Math.min(1, current / target) : 0, done: target > 0 && current >= target }
}

/**
 * Derived state of a goal.
 * cancelled (stored) > achieved (stored) > missed (stored) > achieved (target
 * reached) > missed (endDate before today) > active.
 * @param {object} goal
 * @param {{ done: boolean }} progress  from computeGoalProgress
 * @param {string} today 'yyyy-MM-dd'
 * @returns {'active'|'achieved'|'missed'|'cancelled'}
 */
export function getGoalState(goal, progress, today) {
  if (goal?.status === 'cancelled') return 'cancelled'
  if (goal?.status === 'achieved') return 'achieved'
  if (goal?.status === 'missed') return 'missed'
  if (progress?.done) return 'achieved'
  if (goal?.endDate && today && goal.endDate < today) return 'missed'
  return 'active'
}

/** Days left including today (0 once the end date has passed; full length before it starts). */
export function getGoalDaysLeft(goal, today) {
  if (!goal?.endDate || !today || goal.endDate < today) return 0
  const from = goal.startDate && goal.startDate > today ? goal.startDate : today
  return diffDaysYMD(from, goal.endDate) + 1
}

/** Total length of the goal in days (inclusive). */
export function getGoalLengthDays(goal) {
  if (!goal?.startDate || !goal?.endDate) return 0
  return Math.max(1, diffDaysYMD(goal.startDate, goal.endDate) + 1)
}

/**
 * Pace: where you'd be if progress were spread evenly over the period.
 * @returns {{ elapsedRatio: number, expected: number, onTrack: boolean, perDayNeeded: number }}
 *   perDayNeeded = remaining amount / days left (0 when done or over)
 */
export function getGoalPace(goal, progress, today) {
  const total = getGoalLengthDays(goal)
  let elapsed = 0
  if (total && today >= goal.startDate) elapsed = Math.min(total, diffDaysYMD(goal.startDate, today) + 1)
  const elapsedRatio = total ? elapsed / total : 0
  const expected = progress.target * elapsedRatio
  const left = getGoalDaysLeft(goal, today)
  const remaining = Math.max(0, progress.target - progress.current)
  return {
    elapsedRatio,
    expected,
    onTrack: progress.done || progress.current >= expected,
    perDayNeeded: left > 0 && remaining > 0 ? remaining / left : 0,
  }
}

/** True when a goal was reached before the halfway point of its period (needs achievedAt). */
export function achievedBeforeHalf(goal) {
  const at = goal?.achievedAt
  const ms = at == null ? null : typeof at === 'number' ? at : at.toMillis ? at.toMillis() : at instanceof Date ? at.getTime() : typeof at.seconds === 'number' ? at.seconds * 1000 : null
  if (ms == null || !goal.startDate || !goal.endDate) return false
  const start = parseYMD(goal.startDate).getTime()
  const end = parseYMD(goal.endDate).getTime() + 86400000 // end of the last day
  return ms <= start + (end - start) / 2
}

/**
 * Active goals whose period ended on or before `throughDate` without reaching
 * the target — the weekly close marks them 'missed'.
 * @param {object[]} goals
 * @param {{ workouts?: object[], habitWeeks?: object[], throughDate: string }} opts
 * @returns {object[]} the expired goals
 */
export function findExpiredGoals(goals, { workouts = [], habitWeeks = [], throughDate }) {
  return (goals || []).filter((g) =>
    (g.status || 'active') === 'active' &&
    g.endDate && g.endDate <= throughDate &&
    !computeGoalProgress(g, { workouts, habitWeeks }).done)
}

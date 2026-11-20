// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Habit math + local-date helpers — shared between the web client and Cloud
// Functions. IMPORTANT: no imports outside src/game/ (copied verbatim to
// functions/game/ by scripts/sync-game.mjs).
//
// Dates are local-time 'yyyy-MM-dd' strings everywhere (same as workout.date).
// Habit checks live in habit_weeks/{userId}_{weekId}:
//   { userId, weekId, checks: { [habitId]: ['yyyy-MM-dd', …] } }

import { getWeekId, getWeekRange, getPreviousWeekId, getNextWeekId } from './weekId.js'

// ── Date helpers ─────────────────────────────────────────────

/** Date → 'yyyy-MM-dd' (local time). */
export function formatYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 'yyyy-MM-dd' → Date at local midnight (null for falsy input). */
export function parseYMD(s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Today's local date as 'yyyy-MM-dd'. */
export function todayYMD(now = new Date()) {
  return formatYMD(now)
}

/** Shift a 'yyyy-MM-dd' string by `days` calendar days (DST-safe). */
export function addDaysYMD(s, days) {
  const d = parseYMD(s)
  d.setDate(d.getDate() + days)
  return formatYMD(d)
}

/** Whole days from `a` to `b` ('yyyy-MM-dd'); positive when b is later. */
export function diffDaysYMD(a, b) {
  return Math.round((parseYMD(b) - parseYMD(a)) / 86400000)
}

/** Weekday index with Monday = 0 … Sunday = 6. */
export function weekdayIndex(s) {
  const day = parseYMD(s).getDay() // 0=Sun
  return (day + 6) % 7
}

/** weekId of a 'yyyy-MM-dd' date. */
export function weekIdOfDate(s) {
  return getWeekId(parseYMD(s))
}

/** The 7 dates (Mon..Sun, 'yyyy-MM-dd') of a weekId. */
export function weekDates(weekId) {
  const { start } = getWeekRange(weekId)
  const first = formatYMD(start)
  return Array.from({ length: 7 }, (_, i) => addDaysYMD(first, i))
}

/** Epoch millis of a Firestore Timestamp / Date / number / {seconds}. */
function tsMillis(ts) {
  if (ts == null) return null
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return null
}

// ── Habit week progress ──────────────────────────────────────

/** Clamp a habit's targetPerWeek to 1–7 (default 7). */
export function getHabitTarget(habit) {
  const t = Math.round(Number(habit?.targetPerWeek))
  if (!Number.isFinite(t) || t < 1) return 7
  return Math.min(7, t)
}

/** A habit is "daily" when its weekly target is 7 days. */
export function isDailyHabit(habit) {
  return getHabitTarget(habit) === 7
}

/** Checked dates for one habit in one habit_week doc (deduped, sorted). */
export function getHabitChecks(habitWeek, habitId) {
  const list = habitWeek?.checks?.[habitId]
  return Array.isArray(list) ? [...new Set(list)].sort() : []
}

/**
 * Progress of one habit in one week.
 * @returns {{ habitId, done: number, target: number, met: boolean,
 *   days: boolean[] (Mon..Sun), remaining: number }}
 */
export function computeHabitWeek(habit, habitWeek, weekId) {
  const dates = weekDates(weekId)
  const checked = new Set(getHabitChecks(habitWeek, habit.id))
  const days = dates.map((d) => checked.has(d))
  const done = days.filter(Boolean).length
  const target = getHabitTarget(habit)
  return { habitId: habit.id, done, target, met: done >= target, days, remaining: Math.max(0, target - done) }
}

/** weekId in which a habit was created, or null when createdAt is unknown. */
export function habitStartWeek(habit) {
  const ms = tsMillis(habit?.createdAt)
  return ms == null ? null : getWeekId(new Date(ms))
}

/**
 * Habits that "count" for a week: created on or before that week and either
 * active, or archived but with at least one check in that week (so archiving
 * later doesn't rewrite history).
 */
export function habitsForWeek(habits, weekId, habitWeek = null) {
  return (habits || []).filter((h) => {
    const start = habitStartWeek(h)
    if (start && start > weekId) return false
    if (!h.archived) return true
    return getHabitChecks(habitWeek, h.id).some((d) => weekIdOfDate(d) === weekId)
  })
}

/** Index habit_week docs by weekId (for one user). */
function byWeek(habitWeeks) {
  const map = new Map()
  for (const hw of habitWeeks || []) if (hw?.weekId) map.set(hw.weekId, hw)
  return map
}

/** Earliest week we should look at for a habit's history. */
function earliestWeek(habit, weekMap) {
  const start = habitStartWeek(habit)
  if (start) return start
  let min = null
  for (const [wk, hw] of weekMap) {
    if (getHabitChecks(hw, habit.id).length && (!min || wk < min)) min = wk
  }
  return min
}

/**
 * Weekly streak of a habit: weeks met in a row, counting back from the week
 * before `currentWeekId`, +1 if the current week is already met (the current
 * week never breaks the streak while it's still running).
 * @param {object} habit
 * @param {object[]} habitWeeks  this user's habit_week docs
 * @param {{ currentWeekId: string }} opts
 */
export function getHabitWeekStreak(habit, habitWeeks, { currentWeekId }) {
  const map = byWeek(habitWeeks)
  const first = earliestWeek(habit, map)
  const current = computeHabitWeek(habit, map.get(currentWeekId), currentWeekId)
  let streak = current.met ? 1 : 0
  if (!first) return streak
  let cursor = getPreviousWeekId(currentWeekId)
  for (let guard = 0; guard < 520 && cursor >= first; guard++) {
    if (!computeHabitWeek(habit, map.get(cursor), cursor).met) break
    streak++
    cursor = getPreviousWeekId(cursor)
  }
  return streak
}

/** Best weekly streak of a habit across its whole history (up to currentWeekId). */
export function getBestHabitWeekStreak(habit, habitWeeks, { currentWeekId }) {
  const map = byWeek(habitWeeks)
  const first = earliestWeek(habit, map)
  if (!first) return 0
  let best = 0
  let cur = 0
  let cursor = first
  for (let guard = 0; guard < 520 && cursor <= currentWeekId; guard++) {
    if (computeHabitWeek(habit, map.get(cursor), cursor).met) {
      cur++
      best = Math.max(best, cur)
    } else if (cursor !== currentWeekId) {
      cur = 0
    }
    cursor = getNextWeekId(cursor)
  }
  return best
}

/** All checked dates of a habit across every habit_week doc (deduped, sorted). */
export function getAllHabitDates(habit, habitWeeks) {
  const set = new Set()
  for (const hw of habitWeeks || []) for (const d of getHabitChecks(hw, habit.id)) set.add(d)
  return [...set].sort()
}

/**
 * Current day streak of a habit: consecutive checked days ending today, or
 * ending yesterday when today isn't checked yet (so it doesn't "reset" at
 * midnight).
 */
export function getHabitDayStreak(habit, habitWeeks, today = todayYMD()) {
  const dates = new Set(getAllHabitDates(habit, habitWeeks))
  let cursor = dates.has(today) ? today : addDaysYMD(today, -1)
  let streak = 0
  while (dates.has(cursor)) {
    streak++
    cursor = addDaysYMD(cursor, -1)
  }
  return streak
}

/** Longest run of consecutive checked days for a habit. */
export function getBestHabitDayStreak(habit, habitWeeks) {
  return longestDayRun(getAllHabitDates(habit, habitWeeks))
}

/** Longest run of consecutive days in a sorted, deduped 'yyyy-MM-dd' list. */
export function longestDayRun(sortedDates) {
  if (!sortedDates.length) return 0
  let best = 1
  let cur = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = diffDaysYMD(sortedDates[i - 1], sortedDates[i])
    if (diff === 1) {
      cur++
      if (cur > best) best = cur
    } else if (diff > 1) {
      cur = 1
    }
  }
  return best
}

/**
 * Summary of all of a user's habits for one week.
 * @param {object[]} habits     this user's habits (any visibility)
 * @param {object|null} habitWeek  this user's habit_week doc for weekId
 * @param {string} weekId
 * @param {{ visibility?: 'family'|'all' }} [opts]  'family' drops private habits
 * @returns {{ total, met, perfect: boolean, items: [{ habitId, name, emoji, done, target, met, days }] }}
 */
export function summarizeHabitWeek(habits, habitWeek, weekId, { visibility = 'all' } = {}) {
  const list = habitsForWeek(habits, weekId, habitWeek)
    .filter((h) => visibility === 'all' || (h.visibility || 'family') === 'family')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const items = list.map((h) => {
    const p = computeHabitWeek(h, habitWeek, weekId)
    return { habitId: h.id, name: h.name || '', emoji: h.emoji || '', done: p.done, target: p.target, met: p.met, days: p.days }
  })
  const met = items.filter((i) => i.met).length
  return { total: items.length, met, perfect: items.length > 0 && met === items.length, items }
}

/** True when the user had ≥1 habit that week and met every one of them. */
export function isPerfectHabitWeek(habits, habitWeek, weekId) {
  return summarizeHabitWeek(habits, habitWeek, weekId).perfect
}

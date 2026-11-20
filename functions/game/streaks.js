// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Streak math — shared between the web client and Cloud Functions.
// IMPORTANT: no imports outside src/game/ (copied verbatim to functions/game/).
//
// Weekly streak rules (plan §3):
//   success  = status 'completed', or a v1 week saved by a life (lifeUsed)
//   neutral  = 'rest' and, from v1 history, 'frozen' | 'holiday' | 'paused'
//              (skipped: they neither add to nor break the streak)
//   break    = 'missed' | 'justified'
// Unknown statuses are treated as neutral so a future status can't silently
// wipe everyone's streak.

import { todayYMD, addDaysYMD, longestDayRun } from './habits.js'

export const SUCCESS_STATUSES = ['completed']
export const NEUTRAL_STATUSES = ['rest', 'frozen', 'holiday', 'paused']
export const BREAK_STATUSES = ['missed', 'justified']

/**
 * Classify one weekly summary for streak purposes.
 * @returns {'success'|'neutral'|'break'}
 */
export function classifySummary(summary) {
  if (!summary) return 'neutral'
  if (summary.lifeUsed || SUCCESS_STATUSES.includes(summary.status)) return 'success'
  if (BREAK_STATUSES.includes(summary.status)) return 'break'
  return 'neutral'
}

function sortedByWeek(summaries) {
  return [...(summaries || [])].filter((s) => s?.weekId).sort((a, b) => a.weekId.localeCompare(b.weekId))
}

/**
 * Current weekly streak from one user's summaries.
 *
 * Counts successes backwards from the most recent summary, skipping neutral
 * weeks, stopping at the first break. Options:
 *  - beforeWeekId: only summaries strictly before this week (use the current
 *    week here — the live week has no summary yet).
 *  - throughWeekId: only summaries up to and including this week (use it when
 *    closing a week: "streak including the week being closed").
 *  - currentWeekMet: adds 1 when the running week is already achieved.
 * @returns {number}
 */
export function getWeeklyStreak(summaries, { beforeWeekId, throughWeekId, currentWeekMet = false } = {}) {
  const list = sortedByWeek(summaries).filter((s) =>
    (beforeWeekId == null || s.weekId < beforeWeekId) &&
    (throughWeekId == null || s.weekId <= throughWeekId))
  let streak = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const kind = classifySummary(list[i])
    if (kind === 'break') break
    if (kind === 'success') streak++
  }
  return streak + (currentWeekMet ? 1 : 0)
}

/** Longest weekly streak ever, with the same success/neutral/break rules. */
export function getBestWeeklyStreak(summaries) {
  let best = 0
  let cur = 0
  for (const s of sortedByWeek(summaries)) {
    const kind = classifySummary(s)
    if (kind === 'success') {
      cur++
      if (cur > best) best = cur
    } else if (kind === 'break') {
      cur = 0
    }
  }
  return best
}

/**
 * Last `n` non-neutral summaries (newest first) — used for the "sad" mood and
 * comeback detection.
 */
export function lastDecidedWeeks(summaries, n, { beforeWeekId } = {}) {
  return sortedByWeek(summaries)
    .filter((s) => beforeWeekId == null || s.weekId < beforeWeekId)
    .filter((s) => classifySummary(s) !== 'neutral')
    .reverse()
    .slice(0, n)
}

// ── Day streaks (workouts on consecutive days) ───────────────

function toDates(items) {
  return [...new Set((items || []).map((x) => (typeof x === 'string' ? x : x?.date)).filter(Boolean))].sort()
}

/**
 * Current consecutive-day streak (local dates). Counts back from today, or
 * from yesterday when there's nothing today yet, so it doesn't visually reset
 * at midnight.
 * @param {Array<{date:string}|string>} workoutsOrDates
 * @param {string} [today] 'yyyy-MM-dd' (defaults to the local today)
 */
export function getCurrentDayStreak(workoutsOrDates, today = todayYMD()) {
  const dates = new Set(toDates(workoutsOrDates))
  if (dates.size === 0) return 0
  let cursor = dates.has(today) ? today : addDaysYMD(today, -1)
  let streak = 0
  while (dates.has(cursor)) {
    streak++
    cursor = addDaysYMD(cursor, -1)
  }
  return streak
}

/** Longest consecutive-day streak across all workouts (or dates). */
export function getBestDayStreak(workoutsOrDates) {
  return longestDayRun(toDates(workoutsOrDates))
}

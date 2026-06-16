// Week-id arithmetic — shared between the web client and Cloud Functions.
// IMPORTANT: this module must stay dependency-free (no date-fns) so it can run
// unchanged in both environments. Behavior mirrors the original date-fns
// implementation exactly (verified by the equivalence test in __tests__).
//
// Week IDs look like "2026-W23": the year of the week's Monday plus the week
// number relative to that year's first Monday. Note: in years that don't start
// on Monday the sequence can skip W01 (e.g. 2025-W53 → 2026-W02); the format
// is internally consistent in both directions, and stored data depends on it,
// so it must never change.

/** Parse "yyyy-MM-dd…" as a LOCAL date (same semantics as date-fns parseISO). */
function parseLocalISO(s) {
  const [datePart, timePart] = s.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (!timePart) return new Date(y, m - 1, d)
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map((n) => parseFloat(n) || 0)
  return new Date(y, m - 1, d, hh, mm, ss)
}

/** Monday 00:00 (local) of the week containing `d`. */
function startOfWeekMonday(date) {
  const out = new Date(date)
  const day = out.getDay() || 7 // 1=Mon ... 7=Sun
  out.setDate(out.getDate() - (day - 1))
  out.setHours(0, 0, 0, 0)
  return out
}

/** Add calendar days preserving local wall-clock time (DST-safe, like date-fns). */
function addDaysLocal(date, days) {
  const out = new Date(date)
  out.setDate(out.getDate() + days)
  return out
}

/**
 * Returns the ISO-style week ID for a given date.
 * Format: "YYYY-WXX" where week starts on Monday.
 */
export function getWeekId(date = new Date()) {
  const d = typeof date === 'string' ? parseLocalISO(date) : date
  const weekStart = startOfWeekMonday(d)
  const year = weekStart.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const jan1Monday = new Date(year, 0, 1 + (1 - jan1Day))
  const diff = weekStart - jan1Monday
  const weekNum = Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

/** { start: Monday 00:00, end: Sunday 23:59:59.999 } for a weekId (local time). */
export function getWeekRange(weekId) {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const firstMonday = new Date(year, 0, 1 + (1 - jan1Day))
  const weekStart = addDaysLocal(firstMonday, (week - 1) * 7)
  const weekEnd = addDaysLocal(weekStart, 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { start: weekStart, end: weekEnd }
}

export function getAdjacentWeeks(weekId, before = 3, after = 3) {
  const { start } = getWeekRange(weekId)
  const weeks = []
  for (let i = -before; i <= after; i++) {
    if (i === 0) continue
    weeks.push(getWeekId(addDaysLocal(start, i * 7)))
  }
  return weeks
}

export function getPreviousWeekId(weekId) {
  const { start } = getWeekRange(weekId)
  return getWeekId(addDaysLocal(start, -7))
}

export function getNextWeekId(weekId) {
  const { start } = getWeekRange(weekId)
  return getWeekId(addDaysLocal(start, 7))
}

/** Inclusive list of weekIds between startWeekId and endWeekId (chronological). */
export function getWeeksBetween(startWeekId, endWeekId) {
  if (!startWeekId || !endWeekId) return []
  const weeks = []
  let cursor = startWeekId
  for (let i = 0; i < 104; i++) {
    weeks.push(cursor)
    if (cursor === endWeekId) return weeks
    cursor = getNextWeekId(cursor)
  }
  return weeks
}

/**
 * Recovery window around a multi-week freeze: the [start, end] range itself,
 * plus `padding` ACTIVE (non-frozen) weeks before and after it.
 *
 * Weeks listed in `frozenWeeks` (e.g. a second freeze) are skipped entirely —
 * they neither count toward the padding nor appear in the window — so the
 * window walks outward until it gathers `padding` genuinely active weeks on
 * each side. With no `frozenWeeks`, the result is a contiguous span.
 */
export function getRecoveryWindow(startWeekId, endWeekId, padding = 4, frozenWeeks = null) {
  if (!startWeekId || !endWeekId) return []
  const skip = frozenWeeks instanceof Set ? frozenWeeks : new Set(frozenWeeks || [])

  const before = []
  let cursor = getPreviousWeekId(startWeekId)
  for (let guard = 0; guard < 104 && before.length < padding; guard++) {
    if (!skip.has(cursor)) before.unshift(cursor)
    cursor = getPreviousWeekId(cursor)
  }

  const range = getWeeksBetween(startWeekId, endWeekId)

  const after = []
  cursor = getNextWeekId(endWeekId)
  for (let guard = 0; guard < 104 && after.length < padding; guard++) {
    if (!skip.has(cursor)) after.push(cursor)
    cursor = getNextWeekId(cursor)
  }

  return [...before, ...range, ...after]
}

export function isDateInWeek(date, weekId) {
  const d = typeof date === 'string' ? parseLocalISO(date) : date
  const { start, end } = getWeekRange(weekId)
  return d >= start && d <= end
}

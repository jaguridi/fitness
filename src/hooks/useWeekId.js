import { useMemo } from 'react'
import { startOfWeek, format, addWeeks, subWeeks, parseISO, isWithinInterval, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Returns the ISO-style week ID for a given date.
 * Format: "YYYY-WXX" where week starts on Monday.
 */
export function getWeekId(date = new Date()) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const weekStart = startOfWeek(d, { weekStartsOn: 1 })
  const year = weekStart.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const jan1Monday = new Date(year, 0, 1 + (1 - jan1Day))
  const diff = weekStart - jan1Monday
  const weekNum = Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

export function getWeekRange(weekId) {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const firstMonday = new Date(year, 0, 1 + (1 - jan1Day))
  const weekStart = addWeeks(firstMonday, week - 1)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return { start: weekStart, end: weekEnd }
}

export function getAdjacentWeeks(weekId, before = 3, after = 3) {
  const { start } = getWeekRange(weekId)
  const weeks = []
  for (let i = -before; i <= after; i++) {
    if (i === 0) continue
    const d = addWeeks(start, i)
    weeks.push(getWeekId(d))
  }
  return weeks
}

export function getPreviousWeekId(weekId) {
  const { start } = getWeekRange(weekId)
  return getWeekId(subWeeks(start, 1))
}

export function getNextWeekId(weekId) {
  const { start } = getWeekRange(weekId)
  return getWeekId(addWeeks(start, 1))
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
 * Weeks within `padding` before startWeekId and after endWeekId (inclusive of
 * the [start, end] range itself). Used to compute the auto-recovery window
 * around a multi-week freeze.
 */
export function getRecoveryWindow(startWeekId, endWeekId, padding = 3) {
  if (!startWeekId || !endWeekId) return []
  const { start } = getWeekRange(startWeekId)
  const earliest = getWeekId(addWeeks(start, -padding))
  const { start: endStart } = getWeekRange(endWeekId)
  const latest = getWeekId(addWeeks(endStart, padding))
  return getWeeksBetween(earliest, latest)
}

export function formatWeekLabel(weekId) {
  const { start, end } = getWeekRange(weekId)
  return `${format(start, "d 'de' MMM", { locale: es })} - ${format(end, "d 'de' MMM", { locale: es })}`
}

export function isDateInWeek(date, weekId) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const { start, end } = getWeekRange(weekId)
  return isWithinInterval(d, { start, end })
}

export default function useWeekId() {
  const currentWeekId = useMemo(() => getWeekId(), [])
  return {
    currentWeekId,
    getWeekId,
    getWeekRange,
    getAdjacentWeeks,
    getPreviousWeekId,
    formatWeekLabel,
    isDateInWeek,
  }
}

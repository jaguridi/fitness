/**
 * Client-side date formatting helpers (Spanish, local time).
 * Week arithmetic itself lives in src/game/weekId.js and src/game/habits.js;
 * import from there directly — nothing is re-exported here.
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getWeekRange } from '../game/weekId.js'

/** Short Spanish weekday initials, Monday first (for the L M M J V S D strip). */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Spanish weekday names, Monday first. */
export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Today's local date as 'yyyy-MM-dd'. */
export function todayStr(now = new Date()) {
  return format(now, 'yyyy-MM-dd')
}

/** 'yyyy-MM-dd' → Date at local noon (safe against DST edges). */
export function dateFromStr(s) {
  return new Date(`${s}T12:00:00`)
}

/** "16 de nov. - 22 de nov." style label for a weekId. */
export function formatWeekLabel(weekId) {
  const { start, end } = getWeekRange(weekId)
  return `${format(start, "d 'de' MMM", { locale: es })} - ${format(end, "d 'de' MMM", { locale: es })}`
}

/** "viernes 20 de noviembre" for a 'yyyy-MM-dd' date. */
export function formatDayLong(s) {
  return format(dateFromStr(s), "EEEE d 'de' MMMM", { locale: es })
}

/** "20 nov." for a 'yyyy-MM-dd' date. */
export function formatDayShort(s) {
  return format(dateFromStr(s), 'd MMM', { locale: es })
}

/** Weekday index of a 'yyyy-MM-dd' date with Monday = 0 … Sunday = 6. */
export function weekdayOf(s) {
  return (dateFromStr(s).getDay() + 6) % 7
}

/** Spanish weekday name of a 'yyyy-MM-dd' date ("lunes"…). */
export function weekdayName(s) {
  return WEEKDAY_NAMES[weekdayOf(s)]
}

/**
 * Epoch millis from a Firestore Timestamp, Date, number, ISO string or
 * { seconds } object. Returns null when it can't tell.
 */
export function toMillis(ts) {
  if (ts == null) return null
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6)
  if (typeof ts === 'string') {
    const ms = Date.parse(ts)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

/**
 * Relative time in Spanish: "recién", "hace 5 min", "hace 3 h", "ayer",
 * "hace 4 días", then a date ("12 oct.").
 * @param {*} ts any timestamp shape accepted by toMillis
 * @param {number} [now=Date.now()]
 */
export function timeAgo(ts, now = Date.now()) {
  const ms = toMillis(ts)
  if (ms == null) return ''
  const diff = Math.max(0, now - ms)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const days = Math.ceil((startToday.getTime() - ms) / 86400000)
  if (days <= 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  const d = new Date(ms)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return format(d, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: es })
}

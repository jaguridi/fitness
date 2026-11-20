/**
 * Pure helpers for the Estadísticas screen (no React, no I/O).
 * Formatting of metric values, weekly series, the activity heatmap grid and
 * the month used by the monthly AI recap.
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getWorkoutPoints } from '../../constants.js'
import { workoutWeekId } from '../../game/week.js'
import { weekDates } from '../../game/habits.js'
import { getPreviousWeekId } from '../../game/weekId.js'

/** Metrics offered by the leaderboard (in display order). */
export const LEADERBOARD_METRICS = [
  { value: 'sessions', label: 'Sesiones' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'calories', label: 'Calorías' },
  { value: 'points', label: 'Puntos' },
  { value: 'streak', label: 'Racha' },
]

/** Metrics that make sense week by week (the trend chart). */
export const TREND_METRICS = LEADERBOARD_METRICS.filter((m) => m.value !== 'streak')

export const PERIODS = [
  { value: '4', label: '4 semanas' },
  { value: '12', label: '12 semanas' },
  { value: 'all', label: 'Todo' },
]

const nf = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

/** 1240 → "1.240", 12.5 → "12,5". */
export function formatNumber(n) {
  return nf.format(Number(n) || 0)
}

const plural = (n, one, many) => (Number(n) === 1 ? one : many)

/**
 * Value with its unit, for labels and screen readers.
 * @param {'sessions'|'minutes'|'calories'|'points'|'streak'} metric
 * @param {number} value
 * @param {{ short?: boolean }} [opts] short = compact unit ("min", "kcal", "pts")
 */
export function formatMetric(metric, value, { short = false } = {}) {
  const v = Number(value) || 0
  const n = formatNumber(v)
  switch (metric) {
    case 'minutes':
      return `${n} min`
    case 'calories':
      return `${n} kcal`
    case 'points':
      return short ? `${n} pts` : `${n} ${plural(v, 'punto', 'puntos')}`
    case 'streak':
      return `${n} ${plural(v, 'semana', 'semanas')}`
    default:
      return `${n} ${plural(v, 'sesión', 'sesiones')}`
  }
}

/** Value contributed by one workout to a metric. */
export function workoutValue(w, metric) {
  if (metric === 'minutes') return Number(w?.duration) || 0
  if (metric === 'calories') return Number(w?.calories) || 0
  if (metric === 'points') return getWorkoutPoints(w)
  return 1
}

/**
 * One value per week for a member's workouts.
 * @param {object[]} workouts  the member's workouts
 * @param {string[]} weekIds   oldest first
 * @param {'sessions'|'minutes'|'calories'|'points'} metric
 * @returns {Array<{ weekId: string, value: number }>}
 */
export function weeklyMetricSeries(workouts, weekIds, metric) {
  const totals = Object.fromEntries(weekIds.map((w) => [w, 0]))
  for (const w of workouts || []) {
    const wk = workoutWeekId(w)
    if (wk in totals) totals[wk] += workoutValue(w, metric)
  }
  return weekIds.map((weekId) => ({ weekId, value: Math.round(totals[weekId] * 10) / 10 }))
}

/**
 * A "nice" upper bound for an axis (1, 2, 5 × 10ⁿ steps), never below `floor`.
 * Small values (≤ 10, e.g. sessions) just round up: niceMax(3) → 3, niceMax(137) → 200.
 */
export function niceMax(value, floor = 1) {
  const v = Math.max(Number(value) || 0, floor)
  if (v <= 10) return Math.ceil(v)
  const mag = 10 ** Math.floor(Math.log10(v))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (v <= step * mag) return step * mag
  }
  return 10 * mag
}

/** Heatmap intensity 0–4 from minutes trained that day (any session counts at least 1). */
export function activityLevel(day) {
  if (!day || !(day.sessions > 0)) return 0
  const m = Number(day.minutes) || 0
  if (m >= 90) return 4
  if (m >= 60) return 3
  if (m >= 30) return 2
  return 1
}

/**
 * Grid for the activity heatmap: `weeks` columns ending at `endWeekId`, 7 rows
 * (Monday first). Days after `today` are marked `future`.
 * @param {Record<string, { sessions, minutes, calories }>} activityByDate
 * @param {string} endWeekId
 * @param {number} weeks
 * @param {string} today 'yyyy-MM-dd'
 * @returns {{ columns: Array<{ weekId, days: Array<{ date, sessions, minutes, level, future }> }>,
 *   activeDays: number, totalDays: number }}
 */
export function buildHeatmap(activityByDate, endWeekId, weeks, today) {
  const ids = [endWeekId]
  while (ids.length < weeks) ids.unshift(getPreviousWeekId(ids[0]))
  let activeDays = 0
  let totalDays = 0
  const columns = ids.map((weekId) => ({
    weekId,
    days: weekDates(weekId).map((date) => {
      const a = activityByDate?.[date]
      const future = date > today
      const level = future ? 0 : activityLevel(a)
      if (!future) {
        totalDays++
        if (level > 0) activeDays++
      }
      return { date, sessions: a?.sessions || 0, minutes: a?.minutes || 0, level, future }
    }),
  }))
  return { columns, activeDays, totalDays }
}

/** 'yyyy-MM' of the last fully finished month before `today` ('yyyy-MM-dd'). */
export function previousMonthId(today) {
  const [y, m] = String(today).split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return `${py}-${String(pm).padStart(2, '0')}`
}

/** '2026-10' → "octubre". With year: "octubre de 2026". */
export function monthLabel(monthId, { withYear = false } = {}) {
  const [y, m] = String(monthId).split('-').map(Number)
  const d = new Date(y, m - 1, 15)
  return format(d, withYear ? "MMMM 'de' yyyy" : 'MMMM', { locale: es })
}

/** Monday of a weekId as "16 nov". */
export function weekStartLabel(weekId) {
  const [first] = weekDates(weekId)
  return format(new Date(`${first}T12:00:00`), 'd MMM', { locale: es }).replace('.', '')
}

/**
 * Top `n` sports plus an "Otros" bucket.
 * @param {Array<{ type, sessions, minutes }>} byType sorted desc
 */
export function topSports(byType, n = 5) {
  const list = byType || []
  if (list.length <= n + 1) return list
  const rest = list.slice(n)
  return [
    ...list.slice(0, n),
    {
      type: `Otros (${rest.length})`,
      sessions: rest.reduce((s, t) => s + t.sessions, 0),
      minutes: rest.reduce((s, t) => s + t.minutes, 0),
      other: true,
    },
  ]
}

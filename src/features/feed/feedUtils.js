/**
 * Pure helpers for the family feed (no React, no I/O). Tested in
 * ./__tests__/feedUtils.test.js.
 */
import { getExerciseTypes } from '../../constants.js'
import { getWeekRange } from '../../game/weekId.js'
import { workoutWeekId } from '../../game/week.js'
import { toMillis } from '../../utils/dates.js'

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000
export const COMMENT_MAX = 140

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Local 'yyyy-MM-dd' of a timestamp (any shape toMillis accepts). */
export function ymdOf(ts) {
  const ms = toMillis(ts)
  if (ms == null) return null
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whole calendar days between two timestamps (local time). */
function dayDiff(ms, now) {
  return Math.round((startOfDay(now) - startOfDay(ms)) / 86400000)
}

/**
 * A day separator label that carries information:
 * "Hoy", "Ayer", "Lunes 16" (this past week), "Lunes 9 de noviembre",
 * "Lunes 9 de noviembre de 2025" (another year).
 * @param {number} ms
 * @param {number} [now=Date.now()]
 */
export function dayLabel(ms, now = Date.now()) {
  const diff = dayDiff(ms, now)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  const d = new Date(ms)
  const wd = cap(WEEKDAYS[d.getDay()])
  if (diff < 7) return `${wd} ${d.getDate()}`
  const base = `${wd} ${d.getDate()} de ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} de ${d.getFullYear()}`
}

/**
 * Split feed items (newest first) into day groups.
 * @param {{ ts: number }[]} items
 * @returns {{ day: string, items: object[] }[]}  day = local 'yyyy-MM-dd'
 */
export function groupByDay(items) {
  const groups = []
  for (const item of items || []) {
    const day = ymdOf(item.ts) || 'sin-fecha'
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, ts: item.ts, items: [item] })
  }
  return groups
}

/**
 * The position of each workout inside its member's week (1-based), ordered
 * by training date and then by creation time.
 * @param {object[]} workouts
 * @returns {Map<string, number>} workoutId → ordinal
 */
export function sessionOrdinals(workouts) {
  const byWeek = new Map()
  for (const w of workouts || []) {
    const wk = workoutWeekId(w)
    if (!wk || !w.userId) continue
    const k = `${w.userId}:${wk}`
    if (!byWeek.has(k)) byWeek.set(k, [])
    byWeek.get(k).push(w)
  }
  const out = new Map()
  for (const list of byWeek.values()) {
    list
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (toMillis(a.createdAt) ?? 0) - (toMillis(b.createdAt) ?? 0))
      .forEach((w, i) => out.set(w.id, i + 1))
  }
  return out
}

/**
 * "2.ª de 3" — which session of the week it was. Past the goal it's an extra.
 * @returns {{ label: string, tone: 'member'|'done'|'neutral' } | null}
 */
export function sessionLabel(ordinal, goal) {
  if (!ordinal || !goal) return null
  if (ordinal > goal) return { label: 'Extra', tone: 'neutral' }
  return { label: `${ordinal}.ª de ${goal}`, tone: ordinal === goal ? 'done' : 'member' }
}

/**
 * v1 rule (WorkoutEditModal.canEditWorkout): only the owner, only within the
 * first 24 h after it was logged. Docs without createdAt can't be edited.
 */
export function canEditWorkout(workout, currentUserId, now = Date.now()) {
  if (!workout || !currentUserId || workout.userId !== currentUserId) return false
  const created = toMillis(workout.createdAt)
  if (created == null) return false
  return now - created < EDIT_WINDOW_MS
}

/** "45 minutos", "1 minuto", "1 h 30 min". */
export function formatDuration(min) {
  const m = Math.round(Number(min) || 0)
  if (m <= 0) return ''
  if (m < 90) return m === 1 ? '1 minuto' : `${m} minutos`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** "Correr + Pesas" (or "Ejercicio" when the doc has no types). */
export function workoutTitle(workout) {
  const types = getExerciseTypes(workout)
  return types.length ? types.join(' + ') : 'Ejercicio'
}

/** "52 minutos, 480 kcal" */
export function workoutMeta(workout) {
  const parts = []
  const d = formatDuration(workout?.duration)
  if (d) parts.push(d)
  const cal = Number(workout?.calories)
  if (cal > 0) parts.push(`${Math.round(cal).toLocaleString('es-CL')} kcal`)
  return parts.join(', ')
}

/**
 * When a workout was logged on a later day than it was done, a short hint:
 * "del martes 17". Null when it was logged the same day (or can't tell).
 */
export function trainedOnHint(workout) {
  if (!workout?.date) return null
  const created = ymdOf(workout.createdAt)
  if (!created || created === workout.date) return null
  const d = new Date(`${workout.date}T12:00:00`)
  return `del ${WEEKDAYS[d.getDay()]} ${d.getDate()}`
}

/** Spanish list: "Javi", "Javi y Fran", "Javi, Fran y Gonza". */
export function joinNames(names) {
  const list = (names || []).filter(Boolean)
  if (list.length <= 1) return list[0] || ''
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`
}

/**
 * Who reacted, as a caption under the reactions: "Reaccionó Fran",
 * "Reaccionaron Javi, Fran y tú", "Reaccionaste tú". Empty when nobody did.
 */
export function reactorsLine(reactions, members, currentUserId) {
  const ids = Object.entries(reactions || {}).filter(([, e]) => e).map(([u]) => u)
  if (!ids.length) return ''
  const name = (id) => (members || []).find((m) => m.id === id)?.name || 'Alguien'
  const others = ids.filter((id) => id !== currentUserId).map(name)
  const mine = ids.includes(currentUserId)
  if (!others.length) return 'Reaccionaste tú'
  if (mine) return `Reaccionaron ${joinNames([...others, 'tú'])}`
  return `${others.length === 1 ? 'Reaccionó' : 'Reaccionaron'} ${joinNames(others)}`
}

/** "Semana del 10 al 16 de noviembre" (crosses months: "del 30 de noviembre al 6 de diciembre"). */
export function weekRangeLabel(weekId) {
  const { start, end } = getWeekRange(weekId)
  if (start.getMonth() === end.getMonth()) return `Semana del ${start.getDate()} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
  return `Semana del ${start.getDate()} de ${MONTHS[start.getMonth()]} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
}

const NUMBER_WORDS = ['Nadie', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis']
const STATUS_ORDER = { completed: 0, lifeUsed: 0, rest: 1 }

/** Week-post results ordered: achieved first (most sessions first), then rest, then the rest. */
export function sortWeekResults(results) {
  return [...(results || [])].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2) || (b.sessions || 0) - (a.sessions || 0)
  )
}

/**
 * Kind headline for the weekly result card. Never shaming.
 * @param {{ userId, status }[]} results
 * @param {(id:string)=>string} nameOf
 */
export function weekHeadline(results, nameOf = (id) => id) {
  const list = results || []
  const done = list.filter((r) => r.status === 'completed' || r.status === 'lifeUsed')
  const rest = list.filter((r) => r.status === 'rest')
  if (list.length && done.length === list.length) return 'Toda la familia logró la semana'
  if (list.length && done.length + rest.length === list.length && done.length === 0) return 'Semana de descanso para todos'
  if (done.length === 0) return 'Una semana tranquila en la familia'
  if (done.length <= 2) return `${joinNames(done.map((r) => nameOf(r.userId)))} ${done.length === 1 ? 'logró' : 'lograron'} la semana`
  return `${NUMBER_WORDS[done.length] || done.length} lograron la semana`
}

/** Unit shown next to a goal's progress. */
export function goalUnit(goal) {
  if (!goal) return ''
  if (goal.kind === 'manual') return goal.unit || ''
  switch (goal.metric) {
    case 'minutes': return 'minutos'
    case 'calories': return 'kcal'
    case 'habit': return 'días'
    default: return 'sesiones'
  }
}

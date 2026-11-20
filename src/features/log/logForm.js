/**
 * Pure helpers for the "Registrar ejercicio" sheet: initial values,
 * validation, exercise-type ordering, photo-date notes and the celebration
 * decision. No React, no I/O.
 */
import { weekIdOfDate, addDaysYMD } from '../../game/habits.js'
import { formatDayLong } from '../../utils/dates.js'

export const MIN_DURATION = 1
export const MAX_DURATION = 300
export const MAX_CALORIES = 5000
export const DURATION_PRESETS = [20, 30, 45, 60, 90]
/** How many exercise chips show before "Más deportes". */
export const VISIBLE_TYPES = 8

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Initial form values, honoring what openLog(initial) passed.
 * @param {object|null} initial { date?, exerciseType?, duration?, calories?, description? }
 * @param {string} today 'yyyy-MM-dd'
 */
export function initialValues(initial, today) {
  const i = initial || {}
  const date = typeof i.date === 'string' && YMD.test(i.date) && i.date <= today ? i.date : today
  const types = Array.isArray(i.exerciseType) ? i.exerciseType : i.exerciseType ? [i.exerciseType] : []
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v))))
  return {
    date,
    types: types.filter((t) => typeof t === 'string' && t.trim()),
    duration: num(i.duration),
    calories: num(i.calories),
    description: typeof i.description === 'string' ? i.description : '',
  }
}

/** Integer parse of a form field ('' → null, garbage → NaN). */
export function parseIntField(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return NaN
  return parseInt(s, 10)
}

/** "a", "a y b", "a, b y c". */
export function joinEs(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/**
 * Validate the form.
 * @param {{ date: string, today: string, types: string[], duration: string, calories: string,
 *   hasPhoto: boolean, photoBlocked: boolean, processingPhoto: boolean }} v
 * @returns {{ errors: { date?: string, duration?: string, calories?: string },
 *   missing: string[], missingText: string|null, canSubmit: boolean }}
 */
export function validateLog({ date, today, types, duration, calories, hasPhoto, photoBlocked, processingPhoto }) {
  const errors = {}
  if (!date || !YMD.test(date)) errors.date = 'Elige la fecha del ejercicio.'
  else if (date > today) errors.date = 'La fecha no puede ser de un día que aún no llega.'

  const d = parseIntField(duration)
  if (d !== null && (Number.isNaN(d) || d < MIN_DURATION || d > MAX_DURATION)) {
    errors.duration = `Escribe un número entero entre ${MIN_DURATION} y ${MAX_DURATION} minutos.`
  }
  const c = parseIntField(calories)
  if (c !== null && (Number.isNaN(c) || c < 1 || c > MAX_CALORIES)) {
    errors.calories = 'Si las anotas, escribe un número entero entre 1 y 5.000.'
  }

  const missing = []
  if (!types?.length) missing.push('el tipo de ejercicio')
  if (d === null) missing.push('los minutos')
  if (!hasPhoto && !processingPhoto) missing.push('la foto')

  const canSubmit = !Object.keys(errors).length && !missing.length && hasPhoto && !photoBlocked && !processingPhoto
  const verb = missing.length === 1 && !missing[0].startsWith('los ') ? 'Falta' : 'Faltan'
  return { errors, missing, missingText: missing.length ? `${verb} ${joinEs(missing)}.` : null, canSubmit }
}

/** Normalize a custom sport name: trimmed, single spaces, first letter uppercase. */
export function normalizeSportName(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/**
 * Every exercise type (base + family custom sports, 'Otro' last), the ones this
 * person uses most first (ties keep the catalog order).
 * @param {string[]} base EXERCISE_TYPES
 * @param {string[]} custom family custom sports
 * @param {object[]} myWorkouts the current user's workouts
 */
export function orderExerciseTypes(base, custom, myWorkouts) {
  const lower = new Set(base.map((t) => t.toLowerCase()))
  const all = [
    ...base.filter((t) => t !== 'Otro'),
    ...(custom || []).filter((t) => t && !lower.has(t.toLowerCase())),
  ]
  const uses = {}
  for (const w of myWorkouts || []) {
    const ts = Array.isArray(w.exerciseType) ? w.exerciseType : w.exerciseType ? [w.exerciseType] : []
    for (const t of ts) uses[t] = (uses[t] || 0) + 1
  }
  const ordered = all
    .map((t, i) => ({ t, i, n: uses[t] || 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.t)
  return base.includes('Otro') ? [...ordered, 'Otro'] : ordered
}

/** "hoy", "ayer" or "viernes 13 de noviembre". */
export function dateLabel(date, today) {
  if (date === today) return 'hoy'
  if (date === addDaysYMD(today, -1)) return 'ayer'
  return formatDayLong(date)
}

/** "de hoy", "de ayer" or "del viernes 13 de noviembre". */
export function ofDate(date, today) {
  const l = dateLabel(date, today)
  return l === 'hoy' || l === 'ayer' ? `de ${l}` : `del ${l}`
}

/**
 * The note shown under the photo after validatePhotoDate().
 * @param {{ valid: boolean, message: string|null, photoDate: string|null }|null} check
 * @param {string} date reported workout date
 * @param {string} today
 * @returns {{ tone: 'warn'|'block', text: string }|null}
 */
export function photoDateNote(check, date, today) {
  if (!check || (!check.message && check.valid)) return null
  if (!check.valid) {
    return {
      tone: 'block',
      text: `La foto es ${ofDate(check.photoDate, today)} y el ejercicio ${ofDate(date, today)}. Usa una foto de ese día o cambia la fecha.`,
    }
  }
  if (!check.photoDate) {
    return { tone: 'warn', text: 'No pudimos leer la fecha de la foto. Asegúrate de que sea del día del ejercicio.' }
  }
  return {
    tone: 'warn',
    text: `La foto es ${ofDate(check.photoDate, today)}. Es solo un día de diferencia, así que la aceptamos.`,
  }
}

/**
 * Should logging this workout celebrate the week? Only for workouts of the
 * current week that reach (or go beyond) the weekly goal.
 * @param {{ sessions: number, goal: number }} before current week before logging
 * @param {string} workoutDate 'yyyy-MM-dd'
 * @param {string} currentWeekId
 * @returns {{ kind: 'met'|'extra', sessions: number, goal: number, extras: number }|null}
 */
export function getLogCelebration(before, workoutDate, currentWeekId) {
  if (!before || !workoutDate || weekIdOfDate(workoutDate) !== currentWeekId) return null
  const sessions = (before.sessions || 0) + 1
  const goal = before.goal || 1
  if (sessions < goal) return null
  return { kind: sessions === goal ? 'met' : 'extra', sessions, goal, extras: sessions - goal }
}

/** The success toast's description. */
export function successDescription({ sessions, goal, date, today, currentWeekId }) {
  if (weekIdOfDate(date) !== currentWeekId) {
    const l = dateLabel(date, today)
    return `Quedó registrado ${l === 'ayer' ? 'ayer' : `el ${l}`}, en la semana que corresponde.`
  }
  const left = goal - sessions
  if (left > 0) return `Llevas ${sessions} de ${goal}. Te ${left === 1 ? 'falta 1 sesión' : `faltan ${left} sesiones`}.`
  return `Llevas ${sessions} de ${goal} esta semana.`
}

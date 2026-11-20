/**
 * Pure helpers for a member's profile page (no React, no I/O). Tested in
 * ./__tests__/memberUtils.test.js.
 */
import { weekdayIndex } from '../../game/habits.js'

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const plural = (n, one, many) => (n === 1 ? one : many)

/**
 * The status line of a member's current week, in tú form when it's you.
 * @param {{ sessions, goal, met, rest, extras, daysLeft, remaining }} week  getMemberWeek()
 * @param {{ isMe?: boolean }} [opts]
 */
export function statusLine(week, { isMe = false } = {}) {
  if (!week) return ''
  if (week.rest) return isMe ? 'Te tomaste la semana de descanso' : 'Se tomó la semana de descanso'
  if (week.met) {
    const extra = week.extras > 0 ? `, con ${week.extras} ${plural(week.extras, 'sesión extra', 'sesiones extra')}` : ''
    return `Semana lograda${extra}`
  }
  const days = week.daysLeft > 0 ? ` ${week.daysLeft === 1 ? 'Queda 1 día' : `Quedan ${week.daysLeft} días`}.` : ''
  if (!week.sessions) return `${isMe ? 'Aún no entrenas' : 'Aún no entrena'} esta semana.${days}`
  return `${isMe ? 'Llevas' : 'Lleva'} ${week.sessions} de ${week.goal} ${plural(week.goal, 'sesión', 'sesiones')}.${days}`
}

/**
 * Behind pace this week: not met, not resting, and the sessions left are
 * about as many as the days left (little slack).
 */
export function isBehind(week) {
  if (!week || week.met || week.rest || week.closed) return false
  return week.remaining > 0 && week.remaining >= (week.daysLeft || 0) - 1
}

/** Sessions per weekday (Mon..Sun) of a week's workouts. */
export function dayCounts(workouts) {
  const out = Array(7).fill(0)
  for (const w of workouts || []) if (w.date) out[weekdayIndex(w.date)]++
  return out
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * Calendar grid of a month, Monday first, padded with nulls.
 * @param {number} year
 * @param {number} month 0-11
 * @returns {(string|null)[]} 'yyyy-MM-dd' or null; length is a multiple of 7
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0, 12).getDate()
  const cells = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

/** 'yyyy-MM' of a 'yyyy-MM-dd'. */
export const monthKey = (ymd) => (ymd ? ymd.slice(0, 7) : null)

/** Shift a { year, month } by delta months. */
export function addMonths({ year, month }, delta) {
  const d = new Date(year, month + delta, 1, 12)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Workouts grouped by date, each day newest-logged first. */
export function workoutsByDate(workouts) {
  const out = {}
  for (const w of workouts || []) if (w.date) (out[w.date] ||= []).push(w)
  return out
}

/** "martes 17 de noviembre" (+ year when it isn't the reference year). */
export function longDate(ymd, refYear = new Date().getFullYear()) {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
  return d.getFullYear() === refYear ? base : `${base} de ${d.getFullYear()}`
}

const RARITY_ORDER = { comun: 0, rara: 1, epica: 2, legendaria: 3 }

/**
 * Stickers to show off on someone's profile: their latest real unlock first,
 * then the rarest ones (newest first within a rarity).
 * @param {object[]} achievements getAchievements()
 * @param {number} [n=4]
 */
export function stickerShowcase(achievements, n = 4) {
  const earned = (achievements || []).filter((a) => a.earned)
  const latest = earned
    .filter((a) => a.recorded && !a.seeded && a.unlockedAt)
    .sort((a, b) => b.unlockedAt - a.unlockedAt)[0]
  const rarest = [...earned].sort(
    (a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0) || (b.unlockedAt || 0) - (a.unlockedAt || 0) || b.number - a.number
  )
  const out = latest ? [latest] : []
  for (const a of rarest) {
    if (out.length >= n) break
    if (!out.includes(a)) out.push(a)
  }
  return out
}

/** "1.234" with Chilean thousands separator. */
export const fmtNumber = (n) => Math.round(Number(n) || 0).toLocaleString('es-CL')

/** Total minutes as a short stat: "45 min", "12 h", "1.234 h". */
export function formatTotalMinutes(min) {
  const m = Math.round(Number(min) || 0)
  if (m < 120) return { value: fmtNumber(m), unit: 'min' }
  return { value: fmtNumber(Math.round(m / 60)), unit: 'h' }
}

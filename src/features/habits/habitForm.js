/**
 * Pure helpers for the habits screen: labels, form state, validation and the
 * weekly summary. No React here (tested in habitForm.test.js).
 */

export const HABIT_NAME_MAX = 40

/** Curated emojis for the habit picker (content, not interface). */
export const HABIT_EMOJIS = ['✅', '📚', '🧘', '💧', '😴', '🤸', '🍎', '🚶', '✍️', '🥗', '🦷', '🌱', '🎸', '📵']

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

/** First grapheme of a string ("👨‍👩‍👧 hola" → "👨‍👩‍👧"). */
export function firstGrapheme(str) {
  const s = String(str || '').trim()
  if (!s) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next()
    return it.done ? '' : it.value.segment
  }
  return Array.from(s)[0] || ''
}

/** True when the string is (starts with) an emoji. */
export function isEmoji(str) {
  return EMOJI_RE.test(firstGrapheme(str))
}

/** "Todos los días" / "1 día por semana" / "5 días por semana". */
export function habitTargetLabel(target) {
  const n = Math.min(7, Math.max(1, Math.round(Number(target)) || 7))
  if (n === 7) return 'Todos los días'
  return n === 1 ? '1 día por semana' : `${n} días por semana`
}

/** "Racha de 1 semana" / "Racha de 3 semanas" (null when 0). */
export function weekStreakLabel(n) {
  if (!n) return null
  return n === 1 ? 'Racha de 1 semana' : `Racha de ${n} semanas`
}

/** "5 días seguidos" (null below 2: one day isn't a streak yet). */
export function dayStreakLabel(n) {
  if (!n || n < 2) return null
  return `${n} días seguidos`
}

/** A fresh form, optionally prefilled from a HABIT_SUGGESTIONS entry. */
export function emptyHabitForm(suggestion = null) {
  return {
    name: suggestion?.name || '',
    emoji: suggestion?.emoji || '✅',
    targetPerWeek: suggestion?.targetPerWeek || 5,
    visibility: 'family',
  }
}

/** Form state for editing an existing habit doc. */
export function habitFormFromHabit(habit) {
  return {
    name: habit?.name || '',
    emoji: habit?.emoji || '✅',
    targetPerWeek: Math.min(7, Math.max(1, Math.round(Number(habit?.targetPerWeek)) || 7)),
    visibility: habit?.visibility === 'private' ? 'private' : 'family',
  }
}

const norm = (s) => String(s || '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')

/**
 * Validate the habit form.
 * @param {{ name, emoji, targetPerWeek, visibility }} form
 * @param {{ habits?: object[], editingId?: string }} [ctx] the user's habits (for duplicates)
 * @returns {{ name?: string, emoji?: string }} Spanish messages; empty when valid
 */
export function validateHabitForm(form, { habits = [], editingId } = {}) {
  const errors = {}
  const name = String(form.name || '').trim()
  if (!name) errors.name = 'Escribe un nombre para el hábito.'
  else if (name.length > HABIT_NAME_MAX) errors.name = `Usa ${HABIT_NAME_MAX} caracteres como máximo.`
  else if (habits.some((h) => !h.archived && h.id !== editingId && norm(h.name) === norm(name))) {
    errors.name = 'Ya tienes un hábito con ese nombre.'
  }
  if (form.emoji && !isEmoji(form.emoji)) errors.emoji = 'Usa un emoji.'
  return errors
}

/** Payload for actions.saveHabit (id only when editing). */
export function buildHabitPayload(form, id) {
  return {
    ...(id ? { id } : {}),
    name: String(form.name || '').trim(),
    emoji: firstGrapheme(form.emoji) || '✅',
    targetPerWeek: Math.min(7, Math.max(1, Math.round(Number(form.targetPerWeek)) || 7)),
    visibility: form.visibility === 'private' ? 'private' : 'family',
  }
}

/** Suggestions the user doesn't already have (by name). */
export function availableSuggestions(suggestions, habits = []) {
  const taken = new Set(habits.filter((h) => !h.archived).map((h) => norm(h.name)))
  return suggestions.filter((s) => !taken.has(norm(s.name)))
}

/**
 * Weekly summary for the top of the page.
 * @param {Array<{ name, emoji, met, weekStreak, dayStreak }>} progress getHabitProgress() rows
 * @returns {{ total: number, met: number, best: { name, emoji, weeks: number }|null }}
 */
export function summarizeHabits(progress = []) {
  let best = null
  for (const p of progress) {
    if (p.weekStreak > 0 && (!best || p.weekStreak > best.weeks)) best = { name: p.name, emoji: p.emoji, weeks: p.weekStreak }
  }
  return { total: progress.length, met: progress.filter((p) => p.met).length, best }
}

/** Move the item at `index` by `dir` (-1 up, +1 down); returns a new array (same one if it can't move). */
export function moveItem(list, index, dir) {
  const to = index + dir
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/**
 * Pure helpers for personal goals ("metas personales"): quick templates,
 * period presets, the live sentence preview, validation, the payload for
 * actions.saveGoal, kind pace hints and "what counted" for auto goals.
 * No React here (tested in goalForm.test.js).
 */
import { addDaysYMD, diffDaysYMD, formatYMD, getHabitChecks, parseYMD, weekDates, weekIdOfDate } from '../../game/habits.js'

export const GOAL_TITLE_MAX = 60
export const GOAL_UNIT_MAX = 20
export const GOAL_REWARD_MAX = 80

/** Curated emojis for goals (content). */
export const GOAL_EMOJIS = ['🎯', '👟', '⏱️', '🏅', '🏃', '🚴', '🏊', '🧘', '⚽', '🏔️', '💪', '📚', '🏆', '🌱']

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const fmtNumber = (n) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 })

const ymdParts = (s) => {
  const d = parseYMD(s)
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }
}

/** "20 de noviembre" (+ " de 2027" when withYear). */
export function formatDay(s, withYear = false) {
  const p = ymdParts(s)
  return `${p.d} de ${MONTHS[p.m]}${withYear ? ` de ${p.y}` : ''}`
}

/**
 * "entre el 1 y el 31 de diciembre" / "entre el 20 de noviembre y el 31 de diciembre" /
 * "entre el 20 de diciembre de 2026 y el 15 de enero de 2027" / "el 20 de noviembre".
 */
export function formatRange(start, end) {
  if (!start || !end) return ''
  if (start === end) return `el ${formatDay(start)}`
  const a = ymdParts(start)
  const b = ymdParts(end)
  if (a.y !== b.y) return `entre el ${formatDay(start, true)} y el ${formatDay(end, true)}`
  if (a.m !== b.m) return `entre el ${formatDay(start)} y el ${formatDay(end)}`
  return `entre el ${a.d} y el ${formatDay(end)}`
}

// ── Period presets ───────────────────────────────────────────

export const PERIOD_PRESETS = [
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'year', label: 'Fin de año' },
  { id: 'custom', label: 'Personalizada' },
]

const monthBounds = (today) => {
  const d = parseYMD(today)
  return {
    start: formatYMD(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: formatYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

/**
 * Dates of a preset. week = Monday..Sunday of this week, month = the whole
 * calendar month (sessions already logged this month count), year = today
 * until December 31, custom = today + 30 days.
 * @returns {{ startDate: string, endDate: string }}
 */
export function presetDates(preset, today) {
  if (preset === 'week') {
    const days = weekDates(weekIdOfDate(today))
    return { startDate: days[0], endDate: days[6] }
  }
  if (preset === 'month') {
    const { start, end } = monthBounds(today)
    return { startDate: start, endDate: end }
  }
  if (preset === 'year') return { startDate: today, endDate: `${parseYMD(today).getFullYear()}-12-31` }
  return { startDate: today, endDate: addDaysYMD(today, 30) }
}

/** Which preset produces exactly these dates today ('custom' when none). */
export function detectPreset(startDate, endDate, today) {
  for (const p of ['week', 'month', 'year']) {
    const d = presetDates(p, today)
    if (d.startDate === startDate && d.endDate === endDate) return p
  }
  return 'custom'
}

/** Short phrase for auto titles: "en diciembre", "esta semana", "antes de fin de año", "antes del 15 de enero". */
export function periodPhrase(startDate, endDate, today) {
  if (!startDate || !endDate) return ''
  const a = ymdParts(startDate)
  const b = ymdParts(endDate)
  const lastOfMonth = formatYMD(new Date(b.y, b.m + 1, 0))
  if (a.d === 1 && a.y === b.y && a.m === b.m && endDate === lastOfMonth) return `en ${MONTHS[a.m]}`
  const week = presetDates('week', today)
  if (startDate === week.startDate && endDate === week.endDate) return 'esta semana'
  if (b.m === 11 && b.d === 31) return 'antes de fin de año'
  return `antes del ${formatDay(endDate, b.y !== parseYMD(today).getFullYear())}`
}

// ── Units ────────────────────────────────────────────────────

/**
 * Unit word for a goal (or form) and an amount: sesión/sesiones, vez/veces
 * (one sport), minuto/minutos, kcal, día/días, or the manual unit.
 */
export function goalUnit(goal, n) {
  const one = Number(n) === 1
  if (goal?.kind === 'manual') return String(goal.unit || '').trim()
  switch (goal?.metric) {
    case 'minutes':
      return one ? 'minuto' : 'minutos'
    case 'calories':
      return 'kcal'
    case 'habit':
      return one ? 'día' : 'días'
    default:
      if (goal?.exerciseType) return one ? 'vez' : 'veces'
      return one ? 'sesión' : 'sesiones'
  }
}

/** "3 sesiones", "1 vez", "40 minutos", "12,5 km", "4" (manual without unit). */
export function formatAmount(goal, n) {
  const unit = goalUnit(goal, n)
  return unit ? `${fmtNumber(n)} ${unit}` : fmtNumber(n)
}

// ── Sentence preview and auto titles ─────────────────────────

const capitalize = (s) => (s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s)

/**
 * What the goal asks for, without the dates: "12 sesiones", "Yoga 8 veces",
 * "600 minutos de Correr", "5.000 kcal", "Leer 20 días", "100 km".
 */
export function goalAmountPhrase(form, { habitName } = {}) {
  const n = Number(form.target) || 0
  if (form.kind === 'manual') return formatAmount(form, n) || fmtNumber(n)
  if (form.metric === 'habit') return `${habitName || 'Tu hábito'} ${formatAmount(form, n)}`
  if (form.metric === 'minutes' || form.metric === 'calories') {
    return `${formatAmount(form, n)}${form.exerciseType ? ` de ${form.exerciseType}` : ''}`
  }
  return form.exerciseType ? `${form.exerciseType} ${formatAmount(form, n)}` : formatAmount(form, n)
}

/** The live preview: "12 sesiones entre el 1 y el 31 de diciembre". */
export function describeGoal(form, { habitName } = {}) {
  const amount = goalAmountPhrase(form, { habitName })
  const range = formatRange(form.startDate, form.endDate)
  return capitalize([amount, range].filter(Boolean).join(' '))
}

/** A suggested title for auto goals ("12 sesiones en diciembre"); '' for manual ones. */
export function autoTitle(form, { habitName, today } = {}) {
  if (form.kind === 'manual') return ''
  const n = Number(form.target)
  if (!(n > 0)) return ''
  return capitalize([goalAmountPhrase(form, { habitName }), periodPhrase(form.startDate, form.endDate, today)].filter(Boolean).join(' '))
}

// ── Templates ────────────────────────────────────────────────

/**
 * Quick templates (plan §3). `build(ctx)` returns a full form.
 * ctx: { today, weeklyGoal, habits (the user's active habits), favoriteType }
 */
export const GOAL_TEMPLATES = [
  {
    id: 'sessions_month',
    emoji: '👟',
    label: 'Sesiones este mes',
    description: 'Cuántas veces entrenas este mes.',
    build: ({ weeklyGoal = 3 }) => ({ emoji: '👟', kind: 'auto', metric: 'sessions', target: String(weeklyGoal * 4), period: 'month' }),
  },
  {
    id: 'minutes_week',
    emoji: '⏱️',
    label: 'Minutos esta semana',
    description: 'Suma minutos de cualquier ejercicio.',
    build: () => ({ emoji: '⏱️', kind: 'auto', metric: 'minutes', target: '150', period: 'week' }),
  },
  {
    id: 'sport_times',
    emoji: '🏅',
    label: 'Un deporte N veces',
    description: 'Por ejemplo, yoga 8 veces este mes.',
    build: ({ favoriteType }) => ({ emoji: '🏅', kind: 'auto', metric: 'sessions', exerciseType: favoriteType || 'Correr', target: '8', period: 'month' }),
  },
  {
    id: 'habit_days',
    emoji: '✅',
    label: 'Días de un hábito',
    description: 'Por ejemplo, leer 20 días este mes.',
    needsHabit: true,
    build: ({ habits = [] }) => ({ emoji: habits[0]?.emoji || '✅', kind: 'auto', metric: 'habit', habitId: habits[0]?.id || '', target: '20', period: 'month' }),
  },
  {
    id: 'free',
    emoji: '🎯',
    label: 'Meta libre',
    description: 'Tú anotas el avance: 100 km, 4 libros…',
    build: () => ({ emoji: '🎯', kind: 'manual', metric: 'sessions', target: '', unit: '', period: 'custom' }),
  },
]

const BLANK = {
  templateId: null,
  title: '',
  titleTouched: false,
  emoji: '🎯',
  kind: 'auto',
  metric: 'sessions',
  exerciseType: '',
  habitId: '',
  target: '',
  unit: '',
  progress: 0,
  period: 'month',
  startDate: '',
  endDate: '',
  reward: '',
  visibility: 'family',
}

/**
 * A new form from a template id (or a blank auto goal when unknown).
 * @param {string|null} templateId
 * @param {{ today: string, weeklyGoal?: number, habits?: object[], favoriteType?: string }} ctx
 */
export function formFromTemplate(templateId, ctx) {
  const tpl = GOAL_TEMPLATES.find((t) => t.id === templateId)
  const base = { ...BLANK, ...(tpl ? tpl.build(ctx) : {}), templateId: tpl?.id || null }
  const form = { ...base, ...presetDates(base.period, ctx.today) }
  const habitName = (ctx.habits || []).find((h) => h.id === form.habitId)?.name
  return { ...form, title: autoTitle(form, { habitName, today: ctx.today }) }
}

/** Form state for editing an existing goal doc. */
export function formFromGoal(goal, today) {
  return {
    ...BLANK,
    title: goal.title || '',
    titleTouched: true,
    emoji: goal.emoji || '🎯',
    kind: goal.kind === 'manual' ? 'manual' : 'auto',
    metric: goal.metric || 'sessions',
    exerciseType: goal.exerciseType || '',
    habitId: goal.habitId || '',
    target: goal.target != null ? String(goal.target) : '',
    unit: goal.unit || '',
    progress: Number(goal.progress) || 0,
    startDate: goal.startDate || '',
    endDate: goal.endDate || '',
    period: detectPreset(goal.startDate, goal.endDate, today),
    reward: goal.reward || '',
    visibility: goal.visibility === 'private' ? 'private' : 'family',
  }
}

/**
 * Apply a patch to the form: presets fill the dates and, while the title
 * hasn't been typed by hand, auto goals get a fresh suggested title.
 */
export function updateForm(form, patch, { today, habits = [] } = {}) {
  let next = { ...form, ...patch }
  if ('period' in patch && patch.period !== 'custom') next = { ...next, ...presetDates(patch.period, today) }
  if ('title' in patch) next.titleTouched = true
  if (!next.titleTouched && next.kind === 'auto') {
    const habitName = habits.find((h) => h.id === next.habitId)?.name
    next.title = autoTitle(next, { habitName, today })
  }
  return next
}

// ── Validation and payload ───────────────────────────────────

/**
 * @param {object} form
 * @param {{ today: string, isNew?: boolean }} ctx
 * @returns {Record<string,string>} Spanish messages keyed by field; empty when valid
 */
export function validateGoalForm(form, { today, isNew = true } = {}) {
  const errors = {}
  const title = String(form.title || '').trim()
  if (!title) errors.title = 'Ponle un título a tu meta.'
  else if (title.length > GOAL_TITLE_MAX) errors.title = `Usa ${GOAL_TITLE_MAX} caracteres como máximo.`

  const raw = String(form.target ?? '').trim().replace(',', '.')
  const target = Number(raw)
  if (!raw || !Number.isFinite(target) || target <= 0) errors.target = 'El objetivo tiene que ser mayor que 0.'
  else if (form.kind === 'auto' && !Number.isInteger(target)) errors.target = 'Usa un número entero.'
  else if (form.kind === 'auto' && form.metric === 'habit' && form.startDate && form.endDate &&
    target > diffDaysYMD(form.startDate, form.endDate) + 1) {
    errors.target = 'Son más días de los que tiene el plazo.'
  }

  if (form.kind === 'auto' && form.metric === 'habit' && !form.habitId) errors.habitId = 'Elige un hábito.'
  if (form.kind === 'manual' && String(form.unit || '').trim().length > GOAL_UNIT_MAX) {
    errors.unit = `Usa ${GOAL_UNIT_MAX} caracteres como máximo.`
  }
  if (String(form.reward || '').trim().length > GOAL_REWARD_MAX) errors.reward = `Usa ${GOAL_REWARD_MAX} caracteres como máximo.`

  if (!form.startDate || !form.endDate) errors.dates = 'Elige la fecha de inicio y la de término.'
  else if (form.endDate < form.startDate) errors.dates = 'La fecha de término no puede ser antes del inicio.'
  else if (isNew && today && form.endDate < today) errors.dates = 'La fecha de término ya pasó.'
  return errors
}

/**
 * Payload for actions.saveGoal. Unused fields are null so an edit removes
 * them (the backend deletes null fields on update and skips them on create).
 */
export function buildGoalPayload(form, { id } = {}) {
  const manual = form.kind === 'manual'
  const target = Number(String(form.target).trim().replace(',', '.'))
  const auto = !manual
  return {
    ...(id ? { id } : {}),
    title: String(form.title || '').trim(),
    emoji: form.emoji || '🎯',
    kind: manual ? 'manual' : 'auto',
    metric: auto ? form.metric : null,
    exerciseType: auto && form.metric !== 'habit' && form.exerciseType ? form.exerciseType : null,
    habitId: auto && form.metric === 'habit' ? form.habitId : null,
    target,
    unit: manual && String(form.unit || '').trim() ? String(form.unit).trim() : null,
    progress: manual ? Math.max(0, Number(form.progress) || 0) : null,
    startDate: form.startDate,
    endDate: form.endDate,
    reward: String(form.reward || '').trim() || null,
    visibility: form.visibility === 'private' ? 'private' : 'family',
  }
}

// ── Pace and "what counted" ──────────────────────────────────

function roundUpPerWeek(goal, x) {
  if (goal.kind === 'manual') return Math.ceil(x * 10) / 10
  if (goal.metric === 'minutes') return Math.ceil(x / 5) * 5
  if (goal.metric === 'calories') return Math.ceil(x / 50) * 50
  return Math.ceil(x)
}

/**
 * A kind one-line hint for an active goal (null otherwise).
 * @param {ReturnType<import('../../data/selectors.js').getGoalView>} view
 * @param {string} today
 */
export function goalPaceHint(view, today) {
  if (!view || view.state !== 'active') return null
  const { goal, progress, pace, daysLeft } = view
  if (goal.startDate && today < goal.startDate) return `Empieza el ${formatDay(goal.startDate)}.`
  const remaining = Math.max(0, progress.target - progress.current)
  if (remaining <= 0) return null
  const left = formatAmount(goal, remaining)
  if (daysLeft <= 1) return `Hoy es el último día. Te faltan ${left}.`
  if (pace?.onTrack) return progress.current > 0 ? `Vas al día. Te faltan ${left}.` : `Recién empieza. Te faltan ${left}.`
  if (daysLeft <= 7) return `Te faltan ${left} en ${daysLeft} días. Todavía se puede.`
  const perWeek = roundUpPerWeek(goal, remaining / (daysLeft / 7))
  return `Con ${formatAmount(goal, perWeek)} por semana la logras.`
}

const typesOf = (w) => (Array.isArray(w?.exerciseType) ? w.exerciseType : w?.exerciseType ? [w.exerciseType] : [])

/**
 * What counts towards an auto goal (same rules as computeGoalProgress).
 * @returns {{ kind: 'workouts', items: Array<{ id, date, types: string[], duration, calories, value }>, total }
 *   | { kind: 'habit', dates: string[], total } | { kind: 'manual', total }}
 */
export function goalContributions(goal, { workouts = [], habitWeeks = [] } = {}) {
  const inRange = (d) => !!d && d >= goal.startDate && d <= goal.endDate
  if (goal.kind === 'manual') return { kind: 'manual', total: Math.max(0, Number(goal.progress) || 0) }
  if (goal.metric === 'habit') {
    const set = new Set()
    for (const hw of habitWeeks) {
      if (goal.userId && hw.userId && hw.userId !== goal.userId) continue
      for (const d of getHabitChecks(hw, goal.habitId)) if (inRange(d)) set.add(d)
    }
    const dates = [...set].sort().reverse()
    return { kind: 'habit', dates, total: dates.length }
  }
  const items = workouts
    .filter((w) => (!goal.userId || w.userId === goal.userId) && inRange(w.date) && (!goal.exerciseType || typesOf(w).includes(goal.exerciseType)))
    .map((w) => {
      const duration = Number(w.duration) || 0
      const calories = Number(w.calories) || 0
      const value = goal.metric === 'minutes' ? duration : goal.metric === 'calories' ? calories : 1
      return { id: w.id, date: w.date, types: typesOf(w), duration, calories, value }
    })
    .filter((i) => goal.metric !== 'calories' || i.calories > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  return { kind: 'workouts', items, total: items.reduce((s, i) => s + i.value, 0) }
}

/** "Cuentan tus sesiones de Yoga", "Cuentan los minutos de todos tus ejercicios"… */
export function countsSentence(goal, { habitName } = {}) {
  if (goal.kind === 'manual') return 'Tú anotas el avance.'
  if (goal.metric === 'habit') return `Cuentan los días que marcas ${habitName || 'el hábito'}.`
  const what = goal.exerciseType ? `de ${goal.exerciseType}` : 'de cualquier ejercicio'
  if (goal.metric === 'minutes') return `Cuentan los minutos de tus sesiones ${what}.`
  if (goal.metric === 'calories') return `Cuentan las calorías de tus sesiones ${what} (solo las que tienen calorías anotadas).`
  return `Cuentan tus sesiones ${what}.`
}

/** The user's most frequent exercise type (excluding "Otro"), or null. */
export function favoriteExerciseType(workouts = []) {
  const counts = {}
  for (const w of workouts) for (const t of typesOf(w)) if (t && t !== 'Otro') counts[t] = (counts[t] || 0) + 1
  let best = null
  for (const [t, c] of Object.entries(counts)) if (!best || c > counts[best]) best = t
  return best
}

/** "lun 17 nov" for list rows. */
export function formatShortDay(s) {
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const d = parseYMD(s)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

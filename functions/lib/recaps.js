// AI recaps (weekly + monthly) for v2 — input builders and prompts are pure
// (no Firebase imports) so they can be tested offline; the OpenAI call takes
// an injected client.
//
// v2 inputs: sessions vs each member's own goal, weekly streaks, habits,
// stickers earned, family-visible goals created/achieved. Nothing about fines,
// the pot, lives or shields. Private habits/goals never reach the prompt (the
// recap is shown to the whole family).

import { USER_GENDER, USER_IDS } from '../game/constants.js'
import { genderGuide, stripGenderTags } from '../game/recapText.js'
import { getWeekRange, getWeekId } from '../game/weekId.js'
import { getWeeklyStreak, classifySummary } from '../game/streaks.js'
import { formatYMD, parseYMD, weekDates } from '../game/habits.js'

// Keep exactly as in v1: provider, model id, reasoning effort, budget.
export const RECAP_MODEL = 'gpt-5.6-luna'
export const RECAP_REASONING_EFFORT = 'high'
export const RECAP_MAX_COMPLETION_TOKENS = 8000

// Recap prompts pass gender in a separate genderGuide() block; this tells the
// model to use it for agreement only (W42 leaked "Jose (hombre)" into the copy).
export const GENDER_RULE = `Al final del mensaje viene el género gramatical de cada persona: úsalo SIEMPRE al conjugar
adjetivos y artículos (ej.: para una mujer usa "cansada", "la campeona", no "cansado").
NUNCA escribas el género en el texto: nada de "(hombre)", "(mujer)" ni etiquetas parecidas
junto a los nombres. Escribe cada nombre solo, tal como viene.`

const VOICE_RULE = `Escribe en español neutro de Chile, de tú. NUNCA uses voseo ("vos", "podés", "tenés", "elegí", "tenís").
El reto ya NO tiene multas, pozo, vidas ni escudos: no los menciones nunca.
Sin vergüenza ni castigo: a quien no logró su meta se le anima mirando hacia adelante, sin regaños.`

export const WEEKLY_SYSTEM_PROMPT = `Eres el narrador cariñoso del álbum familiar "FitFamily": 4 personas de una familia que
entrenan y cuidan sus hábitos. Cada persona tiene su propia meta semanal de sesiones (no es la misma para todos).
Genera un resumen semanal breve y entretenido (máximo 4-5 frases) con humor amable y referencias deportivas.
Celebra a quienes lograron su meta y las rachas largas; menciona láminas ganadas y metas personales logradas
(y su recompensa, si la hay). A quien no la logró, dale ánimo para la próxima semana.
estado=rest es una semana de descanso elegida por la persona: es neutra, no la critiques.
Incluye 2-3 emojis. NO uses formato markdown. Solo texto plano con saltos de línea.
${VOICE_RULE}
${GENDER_RULE}`

export const MONTHLY_SYSTEM_PROMPT = `Eres el narrador del álbum familiar "FitFamily". Escribe un recap mensual
(6-8 frases) con humor cariñoso y referencias deportivas. Cada persona tiene su propia meta semanal de sesiones.
Estructura sugerida:
1. Una oración de apertura sobre el mes
2. Quién destacó (semanas logradas, rachas, hábitos, metas personales logradas)
3. Ánimo para quien le costó más (con cariño, mirando al mes siguiente)
4. Algún dato curioso (sesiones totales, minutos, kcal, láminas nuevas, el deporte más repetido)
5. Una proyección o consejo para el mes siguiente
Las semanas de descanso son neutras: no las critiques.
${VOICE_RULE}
${GENDER_RULE}
No uses markdown. Solo texto plano con saltos de línea. Máximo 3 emojis en total.`

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Epoch millis of a Firestore Timestamp / Date / number / {seconds|_seconds}. */
export function toMillis(ts) {
  if (ts == null) return null
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  if (typeof ts._seconds === 'number') return ts._seconds * 1000
  return null
}

const isFamilyVisible = (doc) => (doc?.visibility || 'family') === 'family'
const nameOf = (users, id) => (users || []).find((u) => u.id === id)?.name || id
const inMs = (ms, startMs, endMs) => ms != null && ms >= startMs && ms < endMs

/** v1 + v2 statuses → 'completed' | 'missed' | 'rest' (neutral) for recap counting. */
export function recapStatus(summary) {
  const kind = classifySummary(summary)
  if (kind === 'success') return 'completed'
  if (kind === 'break') return 'missed'
  return 'rest'
}

/** [startMs, endMs) of a week (local midnight Monday → next Monday). */
function weekWindow(weekId) {
  const dates = weekDates(weekId)
  const start = parseYMD(dates[0]).getTime()
  const end = parseYMD(dates[6])
  end.setDate(end.getDate() + 1)
  return [start, end.getTime()]
}

/** Stickers (non-seeded) and family goals created/achieved by a user inside [startMs, endMs). */
function socialFacts({ userId, unlocks, goals, startMs, endMs }) {
  const stickers = (unlocks || [])
    .filter((u) => u.userId === userId && !u.seeded && inMs(toMillis(u.createdAt), startMs, endMs))
    .map((u) => [u.icon, u.name].filter(Boolean).join(' '))
  const familyGoals = (goals || []).filter((g) => g.userId === userId && isFamilyVisible(g))
  const goalsCreated = familyGoals
    .filter((g) => inMs(toMillis(g.createdAt), startMs, endMs))
    .map((g) => [g.emoji, g.title].filter(Boolean).join(' '))
  const goalsAchieved = familyGoals
    .filter((g) => g.status === 'achieved' && inMs(toMillis(g.achievedAt), startMs, endMs))
    .map((g) => ({ title: [g.emoji, g.title].filter(Boolean).join(' '), reward: g.reward || null }))
  return { stickers, goalsCreated, goalsAchieved }
}

/**
 * Weekly recap input, one row per member with a summary that week.
 * @param {{ weekId, users, summaries (ALL weekly_summaries, for streaks), unlocks?, goals? }} p
 * @returns {Array<{ userId, name, gender, status, sessions, goal, streak, minutes,
 *   habitsMet, habitsTotal, habits: string[], stickers: string[], goalsCreated: string[],
 *   goalsAchieved: Array<{ title, reward }> }>}
 */
export function buildWeeklyRecapInput({ weekId, users, summaries, unlocks = [], goals = [] }) {
  const [startMs, endMs] = weekWindow(weekId)
  const weekSummaries = (summaries || []).filter((s) => s.weekId === weekId)
  const order = (id) => (USER_IDS.indexOf(id) + 1 || 99)
  return weekSummaries
    .sort((a, b) => order(a.userId) - order(b.userId))
    .map((s) => {
      const history = (summaries || []).filter((x) => x.userId === s.userId)
      const items = Array.isArray(s.habits?.items) ? s.habits.items : []
      return {
        userId: s.userId,
        name: nameOf(users, s.userId),
        gender: USER_GENDER[s.userId],
        status: s.v === 2 ? s.status : recapStatus(s),
        sessions: s.sessions || 0,
        goal: s.goal ?? s.totalRequired ?? 3,
        streak: getWeeklyStreak(history, { throughWeekId: weekId }),
        minutes: s.minutes || 0,
        habitsMet: s.habits?.met || 0,
        habitsTotal: s.habits?.total || 0,
        habits: items.map((i) => `${[i.emoji, i.name].filter(Boolean).join(' ')} ${i.done}/${i.target}`),
        ...socialFacts({ userId: s.userId, unlocks, goals, startMs, endMs }),
      }
    })
}

/** Prompt data lines for the weekly recap. */
export function weeklyRecapText(weekId, people) {
  const lines = people.map((p) => {
    const parts = [`${p.name}: ${p.sessions}/${p.goal} sesiones (su meta), estado=${p.status}, racha=${p.streak} semanas`]
    if (p.minutes > 0) parts.push(`${p.minutes} min`)
    if (p.habitsTotal > 0) parts.push(`hábitos logrados ${p.habitsMet}/${p.habitsTotal} (${p.habits.join(', ')})`)
    if (p.stickers.length) parts.push(`láminas nuevas: ${p.stickers.join(', ')}`)
    if (p.goalsCreated.length) parts.push(`se propuso: ${p.goalsCreated.join(', ')}`)
    for (const g of p.goalsAchieved) parts.push(`logró su meta ${g.title}${g.reward ? ` y se ganó: ${g.reward}` : ''}`)
    return parts.join('; ')
  })
  return `Resumen de la semana ${weekId}:\n${lines.join('\n')}`
}

/** 'yyyy-MM' → [startMs, endMs) and label. */
export function monthWindow(monthId) {
  const [year, month] = monthId.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { year, month, start, end, label: `${MONTH_NAMES[month - 1]} ${year}` }
}

/** A week belongs to the month whose dates contain its Monday. */
export function weekInMonth(weekId, monthId) {
  const { start } = getWeekRange(weekId)
  return formatYMD(start).slice(0, 7) === monthId
}

/**
 * Monthly recap input.
 * @param {{ monthId, users, summaries (all), workouts (all), habitWeeks?, habits?, unlocks?, goals? }} p
 * @returns {{ label: string, perUser: object[], totals: { sessions, minutes, calories } }}
 */
export function buildMonthlyRecapInput({ monthId, users, summaries, workouts, habitWeeks = [], habits = [], unlocks = [], goals = [] }) {
  const { start, end, label } = monthWindow(monthId)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const monthWorkouts = (workouts || []).filter((w) => w.date && w.date.slice(0, 7) === monthId)
  const monthSummaries = (summaries || []).filter((s) => s.weekId && weekInMonth(s.weekId, monthId))
  const familyHabitIds = new Set((habits || []).filter(isFamilyVisible).map((h) => h.id))
  const lastWeek = getWeekId(new Date(end.getTime() - 86400000))

  const perUser = []
  for (const userId of USER_IDS) {
    const mine = monthWorkouts.filter((w) => w.userId === userId)
    const weeks = monthSummaries.filter((s) => s.userId === userId)
    const typeCount = {}
    for (const w of mine) {
      const types = Array.isArray(w.exerciseType) ? w.exerciseType : w.exerciseType ? [w.exerciseType] : []
      for (const t of types) typeCount[t] = (typeCount[t] || 0) + 1
    }
    const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
    const habitDays = new Set()
    for (const hw of habitWeeks || []) {
      if (hw.userId !== userId) continue
      for (const [habitId, dates] of Object.entries(hw.checks || {})) {
        if (!familyHabitIds.has(habitId) || !Array.isArray(dates)) continue
        for (const d of dates) if (typeof d === 'string' && d.slice(0, 7) === monthId) habitDays.add(`${habitId}|${d}`)
      }
    }
    const statuses = weeks.map(recapStatus)
    const row = {
      userId,
      name: nameOf(users, userId),
      gender: USER_GENDER[userId],
      sessions: mine.length,
      minutes: mine.reduce((s, w) => s + (Number(w.duration) || 0), 0),
      calories: mine.reduce((s, w) => s + (Number(w.calories) || 0), 0),
      weeksCompleted: statuses.filter((s) => s === 'completed').length,
      weeksMissed: statuses.filter((s) => s === 'missed').length,
      weeksRest: statuses.filter((s) => s === 'rest').length,
      streak: getWeeklyStreak((summaries || []).filter((s) => s.userId === userId), { throughWeekId: lastWeek }),
      habitChecks: habitDays.size,
      habitWeeksMet: weeks.reduce((s, w) => s + (w.habits?.met || 0), 0),
      topTypes,
      ...socialFacts({ userId, unlocks, goals, startMs, endMs }),
    }
    if (row.sessions || weeks.length || row.habitChecks || row.stickers.length || row.goalsCreated.length) perUser.push(row)
  }
  return {
    label,
    perUser,
    totals: {
      sessions: monthWorkouts.length,
      minutes: monthWorkouts.reduce((s, w) => s + (Number(w.duration) || 0), 0),
      calories: monthWorkouts.reduce((s, w) => s + (Number(w.calories) || 0), 0),
    },
  }
}

/** Prompt data lines for the monthly recap. */
export function monthlyRecapText(input) {
  const lines = input.perUser.map((u) => {
    const decided = u.weeksCompleted + u.weeksMissed
    const parts = [`${u.name}: ${u.sessions} sesiones, ${u.minutes} min`]
    if (decided > 0) parts.push(`${u.weeksCompleted}/${decided} semanas logradas`)
    if (u.weeksRest > 0) parts.push(`${u.weeksRest} de descanso`)
    parts.push(`racha actual ${u.streak} semanas`)
    if (u.calories > 0) parts.push(`${u.calories} kcal`)
    if (u.topTypes.length) parts.push(`más repetido: ${u.topTypes.join(', ')}`)
    if (u.habitChecks > 0) parts.push(`${u.habitChecks} días de hábitos marcados`)
    if (u.stickers.length) parts.push(`láminas nuevas: ${u.stickers.join(', ')}`)
    if (u.goalsCreated.length) parts.push(`se propuso: ${u.goalsCreated.join(', ')}`)
    for (const g of u.goalsAchieved) parts.push(`logró su meta ${g.title}${g.reward ? ` y se ganó: ${g.reward}` : ''}`)
    return parts.join('; ')
  })
  const t = input.totals
  return `Resumen mensual de ${input.label}:\n${lines.join('\n')}\n` +
    `Total familiar: ${t.sessions} sesiones, ${t.minutes} min${t.calories ? `, ${t.calories} kcal` : ''}.`
}

/**
 * Call the model and clean the answer. `client` is an OpenAI instance
 * (injected so tests can pass a fake).
 */
export async function completeRecap(client, { system, user, people, names }) {
  const completion = await client.chat.completions.create({
    model: RECAP_MODEL,
    reasoning_effort: RECAP_REASONING_EFFORT,
    max_completion_tokens: RECAP_MAX_COMPLETION_TOKENS,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${user}\n\n${genderGuide(people)}` },
    ],
  })
  return stripGenderTags(completion.choices?.[0]?.message?.content || 'No se pudo generar el resumen.', names)
}

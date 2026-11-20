/**
 * The sticker album ("álbum de láminas") — achievement definitions, rarity,
 * album pages and progress. Pure, client-only (not shared with Functions).
 *
 * IMPORTANT
 * - `id`s of v1 achievements must never change: production
 *   achievement_unlocks/{userId}_{achievementId} docs reference them.
 * - `number` is the sticker's stable album number. Never renumber; new
 *   stickers take the next free number (currently 54).
 *
 * Every check receives the same context object:
 * @typedef {object} AchievementContext
 * @property {string} userId
 * @property {object} user           merged member (USERS + users doc)
 * @property {object[]} workouts     this user's workouts
 * @property {object[]} summaries    this user's weekly_summaries
 * @property {object[]} habits       this user's habits (any visibility)
 * @property {object[]} habitWeeks   this user's habit_weeks docs
 * @property {object[]} allWorkouts  everyone's workouts
 * @property {object[]} allSummaries everyone's weekly_summaries
 * @property {object[]} weekPosts    week_posts docs
 * @property {object[]} [allUnlocks] achievement_unlocks docs (for social counts)
 * @property {object[]} [goals]      this user's personal goals
 * @property {string}  [weekId]      current weekId (defaults to now)
 * @property {string}  [today]       'yyyy-MM-dd' (defaults to now)
 */
import { getWeekId, getNextWeekId } from '../game/weekId.js'
import { USER_IDS, V2_START_WEEK } from '../game/constants.js'
import { getBestWeeklyStreak, getBestDayStreak, classifySummary } from '../game/streaks.js'
import { workoutWeekId } from '../game/week.js'
import {
  weekdayIndex, todayYMD, getBestHabitDayStreak, isPerfectHabitWeek, habitStartWeek, getHabitChecks,
} from '../game/habits.js'
import { computeGoalProgress, achievedBeforeHalf } from '../game/goals.js'

// ── Album metadata ───────────────────────────────────────────

/** Rarity tiers, from most to least common. */
export const RARITIES = {
  comun: { id: 'comun', label: 'Común', order: 0 },
  rara: { id: 'rara', label: 'Rara', order: 1 },
  epica: { id: 'epica', label: 'Épica', order: 2 },
  legendaria: { id: 'legendaria', label: 'Legendaria', order: 3 },
}

/** Album pages (categories) in display order. `clasicas` only shows earned legacy stickers. */
export const ALBUM_PAGES = [
  { id: 'constancia', title: 'Constancia', description: 'Semanas logradas y días seguidos' },
  { id: 'volumen', title: 'Volumen', description: 'Sesiones acumuladas' },
  { id: 'minutos', title: 'Minutos', description: 'Tiempo de ejercicio' },
  { id: 'calorias', title: 'Calorías', description: 'Energía quemada' },
  { id: 'variedad', title: 'Variedad', description: 'Probar cosas nuevas' },
  { id: 'habitos', title: 'Hábitos', description: 'Lo que cuidas cada día' },
  { id: 'familia', title: 'Familia', description: 'Logros en equipo' },
  { id: 'especiales', title: 'Especiales', description: 'Momentos únicos' },
  { id: 'clasicas', title: 'Clásicas', description: 'Láminas de la temporada de multas' },
]

// ── Helpers ──────────────────────────────────────────────────

const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0)
const totalMinutes = (ws) => sum(ws, (w) => w.duration)
const totalCalories = (ws) => sum(ws, (w) => w.calories)

function exerciseTypesOf(w) {
  if (Array.isArray(w?.exerciseType)) return w.exerciseType.filter(Boolean)
  return w?.exerciseType ? [w.exerciseType] : []
}

function uniqueTypes(workouts) {
  const set = new Set()
  for (const w of workouts) for (const t of exerciseTypesOf(w)) set.add(t)
  return set.size
}

function groupByWeek(workouts) {
  const map = {}
  for (const w of workouts) {
    const wk = workoutWeekId(w)
    if (!wk) continue
    ;(map[wk] ||= []).push(w)
  }
  return map
}

function maxPerWeek(workouts, f) {
  let best = 0
  for (const list of Object.values(groupByWeek(workouts))) best = Math.max(best, sum(list, f))
  return best
}

function maxOf(workouts, f) {
  return workouts.reduce((m, w) => Math.max(m, Number(f(w)) || 0), 0)
}

const isSuccess = (s) => classifySummary(s) === 'success'
const ctxWeekId = (ctx) => ctx.weekId || getWeekId()
const ctxToday = (ctx) => ctx.today || todayYMD()

/** Best day streak of any single habit. */
function bestHabitDayStreak(ctx) {
  return (ctx.habits || []).reduce((m, h) => Math.max(m, getBestHabitDayStreak(h, ctx.habitWeeks)), 0)
}

/** Weeks (chronological) from the user's first habit up to the current week. */
function habitWeekRange(ctx) {
  const habits = ctx.habits || []
  if (!habits.length) return []
  let first = null
  for (const h of habits) {
    const start = habitStartWeek(h)
    if (start && (!first || start < first)) first = start
  }
  for (const hw of ctx.habitWeeks || []) {
    const any = Object.keys(hw.checks || {}).some((id) => getHabitChecks(hw, id).length)
    if (any && (!first || hw.weekId < first)) first = hw.weekId
  }
  if (!first) return []
  const end = ctxWeekId(ctx)
  const out = []
  for (let wk = first, i = 0; wk <= end && i < 520; wk = getNextWeekId(wk), i++) out.push(wk)
  return out
}

/** Per-week "all habits met" flags for this user, chronological. */
function perfectHabitWeeks(ctx) {
  const hwByWeek = new Map((ctx.habitWeeks || []).map((hw) => [hw.weekId, hw]))
  return habitWeekRange(ctx).map((wk) => ({
    weekId: wk,
    perfect: isPerfectHabitWeek(ctx.habits, hwByWeek.get(wk) || null, wk),
  }))
}

function bestRun(flags) {
  let best = 0
  let cur = 0
  for (const f of flags) {
    cur = f ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

/**
 * A "family week": nobody missed, everyone not resting achieved it, and at
 * least 3 of the 4 achieved it (rest/paused weeks don't count against).
 * Returns chronological [{ weekId, family: boolean, succeeded: Set<userId> }].
 */
export function familyWeeks(allSummaries) {
  const byWeek = {}
  for (const s of allSummaries || []) {
    if (!s?.weekId || !USER_IDS.includes(s.userId)) continue
    ;(byWeek[s.weekId] ||= []).push(s)
  }
  return Object.keys(byWeek).sort().map((weekId) => {
    const list = byWeek[weekId]
    const succeeded = new Set(list.filter(isSuccess).map((s) => s.userId))
    const broke = list.some((s) => classifySummary(s) === 'break')
    const missing = USER_IDS.filter((id) => !list.some((s) => s.userId === id)).length
    return { weekId, family: !broke && missing === 0 && succeeded.size >= 3, succeeded }
  })
}

function bestFamilyRun(ctx) {
  return bestRun(familyWeeks(ctx.allSummaries).map((w) => w.family))
}

/** Every doc the family can react to / comment on. */
function socialTargets(ctx) {
  return [...(ctx.allWorkouts || []), ...(ctx.weekPosts || []), ...(ctx.allUnlocks || [])]
}

function reactionsGiven(ctx) {
  return socialTargets(ctx).filter((d) => d?.reactions && d.reactions[ctx.userId]).length
}

function commentsWritten(ctx) {
  return socialTargets(ctx).reduce(
    (n, d) => n + (Array.isArray(d?.comments) ? d.comments.filter((c) => c?.userId === ctx.userId).length : 0), 0)
}

/** This user's achieved goals (stored status, or target reached and not cancelled/missed). */
function achievedGoals(ctx) {
  return (ctx.goals || []).filter((g) => g.status === 'achieved' ||
    ((g.status || 'active') === 'active' && computeGoalProgress(g, { workouts: ctx.workouts, habitWeeks: ctx.habitWeeks }).done))
}

const prog = (current, target) => ({ current: Math.min(current, target), target })

// ── Definitions ──────────────────────────────────────────────
// Ordered by album page, then number.

export const ACHIEVEMENTS = [
  // ── Constancia ─────────────────────────────────────────────
  {
    id: 'first_week', number: 1, name: 'Primera Semana', icon: '🌱',
    description: 'Logra tu primera semana', category: 'constancia', rarity: 'comun',
    check: ({ summaries }) => summaries.some(isSuccess),
    progress: ({ summaries }) => prog(summaries.some(isSuccess) ? 1 : 0, 1),
  },
  {
    id: 'streak_4', number: 2, name: 'Imparable', icon: '🔥',
    description: '4 semanas seguidas logradas', category: 'constancia', rarity: 'rara',
    check: ({ summaries }) => getBestWeeklyStreak(summaries) >= 4,
    progress: ({ summaries }) => prog(getBestWeeklyStreak(summaries), 4),
  },
  {
    id: 'streak_8', number: 3, name: 'Máquina', icon: '⚙️',
    description: '8 semanas seguidas logradas', category: 'constancia', rarity: 'epica',
    check: ({ summaries }) => getBestWeeklyStreak(summaries) >= 8,
    progress: ({ summaries }) => prog(getBestWeeklyStreak(summaries), 8),
  },
  {
    id: 'streak_12', number: 4, name: 'Leyenda', icon: '👑',
    description: '12 semanas seguidas logradas', category: 'constancia', rarity: 'epica',
    check: ({ summaries }) => getBestWeeklyStreak(summaries) >= 12,
    progress: ({ summaries }) => prog(getBestWeeklyStreak(summaries), 12),
  },
  {
    id: 'streak_20', number: 5, name: 'Mito Viviente', icon: '🗿',
    description: '20 semanas seguidas logradas', category: 'constancia', rarity: 'legendaria',
    check: ({ summaries }) => getBestWeeklyStreak(summaries) >= 20,
    progress: ({ summaries }) => prog(getBestWeeklyStreak(summaries), 20),
  },
  {
    id: 'day_streak_7', number: 6, name: 'Semana Sin Fallar', icon: '⚡',
    description: '7 días seguidos con ejercicio', category: 'constancia', rarity: 'rara',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 7,
    progress: ({ workouts }) => prog(getBestDayStreak(workouts), 7),
  },
  {
    id: 'day_streak_14', number: 7, name: 'Dos Semanas Brutales', icon: '🌩️',
    description: '14 días seguidos con ejercicio', category: 'constancia', rarity: 'epica',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 14,
    progress: ({ workouts }) => prog(getBestDayStreak(workouts), 14),
  },
  {
    id: 'day_streak_30', number: 8, name: 'Mes Imparable', icon: '🚀',
    description: '30 días seguidos con ejercicio', category: 'constancia', rarity: 'legendaria',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 30,
    progress: ({ workouts }) => prog(getBestDayStreak(workouts), 30),
  },

  // ── Volumen ────────────────────────────────────────────────
  {
    id: 'sessions_10', number: 9, name: 'Calentamiento', icon: '🏋️',
    description: 'Registra 10 sesiones', category: 'volumen', rarity: 'comun',
    check: ({ workouts }) => workouts.length >= 10,
    progress: ({ workouts }) => prog(workouts.length, 10),
  },
  {
    id: 'sessions_25', number: 10, name: 'En Ritmo', icon: '🥁',
    description: 'Registra 25 sesiones', category: 'volumen', rarity: 'comun',
    check: ({ workouts }) => workouts.length >= 25,
    progress: ({ workouts }) => prog(workouts.length, 25),
  },
  {
    id: 'sessions_50', number: 11, name: 'Medio Centenar', icon: '💯',
    description: 'Registra 50 sesiones', category: 'volumen', rarity: 'rara',
    check: ({ workouts }) => workouts.length >= 50,
    progress: ({ workouts }) => prog(workouts.length, 50),
  },
  {
    id: 'sessions_100', number: 12, name: 'Centurión', icon: '🏆',
    description: 'Registra 100 sesiones', category: 'volumen', rarity: 'epica',
    check: ({ workouts }) => workouts.length >= 100,
    progress: ({ workouts }) => prog(workouts.length, 100),
  },
  {
    id: 'sessions_250', number: 13, name: 'Templo de Acero', icon: '🏛️',
    description: 'Registra 250 sesiones', category: 'volumen', rarity: 'legendaria',
    check: ({ workouts }) => workouts.length >= 250,
    progress: ({ workouts }) => prog(workouts.length, 250),
  },

  // ── Minutos ────────────────────────────────────────────────
  {
    id: 'long_session_60', number: 14, name: 'Hora de Sudor', icon: '⏱️',
    description: 'Una sesión de 60 minutos o más', category: 'minutos', rarity: 'comun',
    check: ({ workouts }) => maxOf(workouts, (w) => w.duration) >= 60,
    progress: ({ workouts }) => prog(maxOf(workouts, (w) => w.duration), 60),
  },
  {
    id: 'long_session_90', number: 15, name: 'Maratón', icon: '🏃',
    description: 'Una sesión de 90 minutos o más', category: 'minutos', rarity: 'rara',
    check: ({ workouts }) => maxOf(workouts, (w) => w.duration) >= 90,
    progress: ({ workouts }) => prog(maxOf(workouts, (w) => w.duration), 90),
  },
  {
    id: 'long_session_120', number: 16, name: 'Resistencia Pura', icon: '🦾',
    description: 'Una sesión de 2 horas o más', category: 'minutos', rarity: 'epica',
    check: ({ workouts }) => maxOf(workouts, (w) => w.duration) >= 120,
    progress: ({ workouts }) => prog(maxOf(workouts, (w) => w.duration), 120),
  },
  {
    id: 'total_minutes_500', number: 17, name: '500 Minutos', icon: '🎖️',
    description: 'Acumula 500 minutos de ejercicio', category: 'minutos', rarity: 'comun',
    check: ({ workouts }) => totalMinutes(workouts) >= 500,
    progress: ({ workouts }) => prog(totalMinutes(workouts), 500),
  },
  {
    id: 'total_minutes_2000', number: 18, name: 'Atleta Dedicado', icon: '🥇',
    description: 'Acumula 2.000 minutos (33 horas)', category: 'minutos', rarity: 'rara',
    check: ({ workouts }) => totalMinutes(workouts) >= 2000,
    progress: ({ workouts }) => prog(totalMinutes(workouts), 2000),
  },
  {
    id: 'total_minutes_5000', number: 19, name: 'Élite', icon: '💎',
    description: 'Acumula 5.000 minutos (83 horas)', category: 'minutos', rarity: 'epica',
    check: ({ workouts }) => totalMinutes(workouts) >= 5000,
    progress: ({ workouts }) => prog(totalMinutes(workouts), 5000),
  },
  {
    id: 'avg_intensity', number: 20, name: 'Intenso', icon: '🔋',
    description: 'Promedio de 45 minutos por sesión (con al menos 10 sesiones)', category: 'minutos', rarity: 'rara',
    check: ({ workouts }) => workouts.length >= 10 && totalMinutes(workouts) / workouts.length >= 45,
  },
  {
    id: 'big_week_minutes', number: 21, name: 'Semana Brutal', icon: '🌋',
    description: '300 minutos o más en una sola semana', category: 'minutos', rarity: 'rara',
    check: ({ workouts }) => maxPerWeek(workouts, (w) => w.duration) >= 300,
    progress: ({ workouts }) => prog(maxPerWeek(workouts, (w) => w.duration), 300),
  },

  // ── Calorías ───────────────────────────────────────────────
  {
    id: 'first_burn', number: 22, name: 'Primer Quemón', icon: '🍳',
    description: 'Registra calorías por primera vez', category: 'calorias', rarity: 'comun',
    check: ({ workouts }) => workouts.some((w) => (w.calories || 0) > 0),
  },
  {
    id: 'session_burn_500', number: 23, name: 'Incinerador', icon: '🌶️',
    description: 'Quema 500 kcal o más en una sesión', category: 'calorias', rarity: 'comun',
    check: ({ workouts }) => maxOf(workouts, (w) => w.calories) >= 500,
    progress: ({ workouts }) => prog(maxOf(workouts, (w) => w.calories), 500),
  },
  {
    id: 'session_burn_1000', number: 24, name: 'Horno Industrial', icon: '🏭',
    description: 'Quema 1.000 kcal o más en una sesión', category: 'calorias', rarity: 'epica',
    check: ({ workouts }) => maxOf(workouts, (w) => w.calories) >= 1000,
    progress: ({ workouts }) => prog(maxOf(workouts, (w) => w.calories), 1000),
  },
  {
    id: 'total_burn_5000', number: 25, name: '5K Quemadas', icon: '♨️',
    description: 'Acumula 5.000 kcal', category: 'calorias', rarity: 'comun',
    check: ({ workouts }) => totalCalories(workouts) >= 5000,
    progress: ({ workouts }) => prog(totalCalories(workouts), 5000),
  },
  {
    id: 'total_burn_20000', number: 26, name: 'Caldera', icon: '🫕',
    description: 'Acumula 20.000 kcal', category: 'calorias', rarity: 'rara',
    check: ({ workouts }) => totalCalories(workouts) >= 20000,
    progress: ({ workouts }) => prog(totalCalories(workouts), 20000),
  },
  {
    id: 'total_burn_100000', number: 27, name: 'Reactor Nuclear', icon: '☢️',
    description: 'Acumula 100.000 kcal', category: 'calorias', rarity: 'legendaria',
    check: ({ workouts }) => totalCalories(workouts) >= 100000,
    progress: ({ workouts }) => prog(totalCalories(workouts), 100000),
  },
  {
    id: 'big_week_calories', number: 28, name: 'Semana Volcánica', icon: '💥',
    description: '3.000 kcal o más en una sola semana', category: 'calorias', rarity: 'rara',
    check: ({ workouts }) => maxPerWeek(workouts, (w) => w.calories) >= 3000,
    progress: ({ workouts }) => prog(maxPerWeek(workouts, (w) => w.calories), 3000),
  },

  // ── Variedad ───────────────────────────────────────────────
  {
    id: 'variety_3', number: 29, name: 'Versátil', icon: '🎯',
    description: 'Prueba 3 tipos de ejercicio distintos', category: 'variedad', rarity: 'comun',
    check: ({ workouts }) => uniqueTypes(workouts) >= 3,
    progress: ({ workouts }) => prog(uniqueTypes(workouts), 3),
  },
  {
    id: 'variety_6', number: 30, name: 'Atleta Completo', icon: '🌈',
    description: 'Prueba 6 tipos de ejercicio distintos', category: 'variedad', rarity: 'rara',
    check: ({ workouts }) => uniqueTypes(workouts) >= 6,
    progress: ({ workouts }) => prog(uniqueTypes(workouts), 6),
  },
  {
    id: 'variety_10', number: 31, name: 'Explorador', icon: '🧭',
    description: 'Prueba 10 tipos de ejercicio distintos', category: 'variedad', rarity: 'epica',
    check: ({ workouts }) => uniqueTypes(workouts) >= 10,
    progress: ({ workouts }) => prog(uniqueTypes(workouts), 10),
  },

  // ── Hábitos ────────────────────────────────────────────────
  {
    id: 'habit_first_check', number: 32, name: 'Primer Check', icon: '✅',
    description: 'Marca un hábito por primera vez', category: 'habitos', rarity: 'comun',
    check: ({ habitWeeks }) => (habitWeeks || []).some((hw) => Object.values(hw.checks || {}).some((l) => l?.length)),
  },
  {
    id: 'habit_streak_7', number: 33, name: 'Siete de Siete', icon: '📿',
    description: '7 días seguidos cumpliendo un hábito', category: 'habitos', rarity: 'rara',
    check: (ctx) => bestHabitDayStreak(ctx) >= 7,
    progress: (ctx) => prog(bestHabitDayStreak(ctx), 7),
  },
  {
    id: 'habit_streak_30', number: 34, name: 'Hábito de Hierro', icon: '🧘',
    description: '30 días seguidos cumpliendo un hábito', category: 'habitos', rarity: 'epica',
    check: (ctx) => bestHabitDayStreak(ctx) >= 30,
    progress: (ctx) => prog(bestHabitDayStreak(ctx), 30),
  },
  {
    id: 'habit_perfect_week', number: 35, name: 'Semana Perfecta', icon: '🌟',
    description: 'Logra todos tus hábitos en una semana', category: 'habitos', rarity: 'rara',
    check: (ctx) => perfectHabitWeeks(ctx).some((w) => w.perfect),
  },
  {
    id: 'habit_perfect_4', number: 36, name: 'Mes Impecable', icon: '🏵️',
    description: '4 semanas seguidas logrando todos tus hábitos', category: 'habitos', rarity: 'epica',
    check: (ctx) => bestRun(perfectHabitWeeks(ctx).map((w) => w.perfect)) >= 4,
    progress: (ctx) => prog(bestRun(perfectHabitWeeks(ctx).map((w) => w.perfect)), 4),
  },

  // ── Familia ────────────────────────────────────────────────
  {
    id: 'family_week', number: 37, name: 'Todos a Una', icon: '🤝',
    description: 'Toda la familia logra la misma semana (los descansos no cuentan en contra)',
    category: 'familia', rarity: 'rara',
    check: ({ allSummaries, userId }) => familyWeeks(allSummaries).some((w) => w.family && w.succeeded.has(userId)),
  },
  {
    id: 'family_streak_2', number: 38, name: 'Equipo Unido', icon: '👨‍👩‍👧‍👦',
    description: '2 semanas seguidas en que toda la familia logra la semana', category: 'familia', rarity: 'epica',
    check: (ctx) => bestFamilyRun(ctx) >= 2,
    progress: (ctx) => prog(bestFamilyRun(ctx), 2),
  },
  {
    id: 'family_streak_4', number: 39, name: 'Clan Imbatible', icon: '🏰',
    description: '4 semanas seguidas en que toda la familia logra la semana', category: 'familia', rarity: 'legendaria',
    check: (ctx) => bestFamilyRun(ctx) >= 4,
    progress: (ctx) => prog(bestFamilyRun(ctx), 4),
  },
  {
    id: 'first_comment', number: 40, name: 'Rompehielos', icon: '💬',
    description: 'Escribe tu primer comentario', category: 'familia', rarity: 'comun',
    check: (ctx) => commentsWritten(ctx) >= 1,
  },
  {
    id: 'reactions_25', number: 41, name: 'Barra Brava', icon: '📣',
    description: 'Reacciona 25 veces a lo de tu familia', category: 'familia', rarity: 'rara',
    check: (ctx) => reactionsGiven(ctx) >= 25,
    progress: (ctx) => prog(reactionsGiven(ctx), 25),
  },

  // ── Especiales ─────────────────────────────────────────────
  {
    id: 'overachiever', number: 42, name: 'Sobrehumano', icon: '🦸',
    description: '5 sesiones o más en una semana', category: 'especiales', rarity: 'rara',
    check: ({ summaries, workouts }) =>
      summaries.some((s) => (s.sessions || 0) >= 5) ||
      Object.values(groupByWeek(workouts)).some((l) => l.length >= 5),
    progress: ({ summaries, workouts }) => prog(Math.max(
      summaries.reduce((m, s) => Math.max(m, s.sessions || 0), 0),
      Object.values(groupByWeek(workouts)).reduce((m, l) => Math.max(m, l.length), 0)), 5),
  },
  {
    id: 'comeback', number: 43, name: 'El Regreso', icon: '🔄',
    description: 'Logra una semana justo después de una que no salió', category: 'especiales', rarity: 'comun',
    check: ({ summaries }) => {
      const decided = [...summaries]
        .filter((s) => s?.weekId && classifySummary(s) !== 'neutral')
        .sort((a, b) => a.weekId.localeCompare(b.weekId))
      return decided.some((s, i) => i > 0 && classifySummary(decided[i - 1]) === 'break' && isSuccess(s))
    },
  },
  {
    id: 'early_bird', number: 44, name: 'Madrugador', icon: '🌅',
    description: '3 sesiones antes del jueves en una misma semana', category: 'especiales', rarity: 'rara',
    check: ({ workouts }) => Object.values(groupByWeek(workouts))
      .some((list) => list.filter((w) => w.date && weekdayIndex(w.date) <= 2).length >= 3),
  },
  {
    id: 'weekend_warrior', number: 45, name: 'Guerrero de Finde', icon: '⚔️',
    description: 'Entrena sábado y domingo del mismo fin de semana', category: 'especiales', rarity: 'comun',
    check: ({ workouts }) => Object.values(groupByWeek(workouts)).some((list) => {
      const days = new Set(list.filter((w) => w.date).map((w) => weekdayIndex(w.date)))
      return days.has(5) && days.has(6)
    }),
  },
  {
    id: 'photo_10', number: 46, name: 'Fotógrafo', icon: '📸',
    description: 'Registra 10 sesiones con foto', category: 'especiales', rarity: 'comun',
    check: ({ workouts }) => workouts.filter((w) => w.photoURL).length >= 10,
    progress: ({ workouts }) => prog(workouts.filter((w) => w.photoURL).length, 10),
  },
  {
    id: 'season2_first', number: 47, name: 'Nueva Temporada', icon: '🎬',
    description: 'Tu primera sesión de la temporada 2', category: 'especiales', rarity: 'comun',
    check: ({ workouts }) => workouts.some((w) => (workoutWeekId(w) || '') >= V2_START_WEEK),
  },

  {
    id: 'goal_first', number: 51, name: 'Palabra Cumplida', icon: '🎯',
    description: 'Logra tu primera meta personal', category: 'especiales', rarity: 'comun',
    check: (ctx) => achievedGoals(ctx).length >= 1,
  },
  {
    id: 'goals_5', number: 52, name: 'Coleccionista de Metas', icon: '🗂️',
    description: 'Logra 5 metas personales', category: 'especiales', rarity: 'epica',
    check: (ctx) => achievedGoals(ctx).length >= 5,
    progress: (ctx) => prog(achievedGoals(ctx).length, 5),
  },
  {
    id: 'goal_fast', number: 53, name: 'A Toda Máquina', icon: '⏩',
    description: 'Logra una meta antes de la mitad del plazo', category: 'especiales', rarity: 'rara',
    check: (ctx) => (ctx.goals || []).some((g) => g.status === 'achieved' && achievedBeforeHalf(g)),
  },

  // ── Clásicas (v1, only shown when already earned) ──────────
  {
    id: 'shield_earned', number: 48, name: 'Escudero', icon: '🛡️',
    description: 'Ganaste un escudo en la temporada de multas', category: 'clasicas', rarity: 'rara', legacy: true,
    check: ({ summaries }) => summaries.some((s) => s.shieldEarned),
  },
  {
    id: 'life_saver', number: 49, name: 'Gato de 7 Vidas', icon: '❤️‍🩹',
    description: 'Usaste una vida extra en la temporada de multas', category: 'clasicas', rarity: 'rara', legacy: true,
    check: ({ summaries }) => summaries.some((s) => s.lifeUsed),
  },
  {
    id: 'clean_record', number: 50, name: 'Intachable', icon: '✨',
    description: 'Nunca pagaste una multa en la temporada de multas', category: 'clasicas', rarity: 'epica', legacy: true,
    // Fines are gone: this sticker can't be newly earned, only kept from v1.
    check: () => false,
  },
]

/** Definition lookup by id. */
export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

/** @returns {object|undefined} the definition for an achievement id */
export function getAchievementDef(id) {
  return ACHIEVEMENTS_BY_ID[id]
}

function normalizeCtx(ctx) {
  return {
    ...ctx,
    workouts: ctx.workouts || [],
    summaries: ctx.summaries || [],
    habits: ctx.habits || [],
    habitWeeks: ctx.habitWeeks || [],
    allWorkouts: ctx.allWorkouts || ctx.workouts || [],
    allSummaries: ctx.allSummaries || ctx.summaries || [],
    weekPosts: ctx.weekPosts || [],
    allUnlocks: ctx.allUnlocks || [],
    goals: ctx.goals || [],
    weekId: ctxWeekId(ctx),
    today: ctxToday(ctx),
  }
}

/**
 * Evaluate every sticker for one user.
 * @param {AchievementContext} ctx
 * @returns {Array<object & { earned: boolean, progress: { current: number, target: number } | null }>}
 *   definitions in album order; `progress` is null when not measurable, and
 *   equals { current: target, target } once earned.
 */
export function evaluateAchievements(ctx) {
  const c = normalizeCtx(ctx)
  return ACHIEVEMENTS.map((def) => {
    let earned = false
    try { earned = !!def.check(c) } catch (err) { console.warn(`achievement ${def.id} check failed`, err) }
    let progress = null
    if (def.progress) {
      try {
        const p = def.progress(c)
        progress = earned ? { current: p.target, target: p.target } : p
      } catch { progress = null }
    }
    return { ...def, earned, progress }
  })
}

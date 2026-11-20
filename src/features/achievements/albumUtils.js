/**
 * Helpers puros del álbum de láminas (sin React): unidades de progreso,
 * "lo que viene", fechas y la comparación familiar.
 */
import { RARITIES } from '../../domain/achievements.js'

const NUM = new Intl.NumberFormat('es-CL')

/** Unidad de cada lámina medible: [singular, plural]. */
const UNITS = {
  semana: ['semana', 'semanas'],
  dia: ['día', 'días'],
  sesion: ['sesión', 'sesiones'],
  minuto: ['minuto', 'minutos'],
  kcal: ['kcal', 'kcal'],
  tipo: ['tipo', 'tipos'],
  reaccion: ['reacción', 'reacciones'],
  meta: ['meta', 'metas'],
}

const UNIT_RULES = [
  [/^(first_week|streak_\d+|family_streak_\d+|habit_perfect_\d+)$/, 'semana'],
  [/^(day_streak_\d+|habit_streak_\d+)$/, 'dia'],
  [/^(sessions_\d+|overachiever|photo_\d+)$/, 'sesion'],
  [/^(long_session_\d+|total_minutes_\d+|big_week_minutes)$/, 'minuto'],
  [/^(session_burn_\d+|total_burn_\d+|big_week_calories)$/, 'kcal'],
  [/^variety_\d+$/, 'tipo'],
  [/^reactions_\d+$/, 'reaccion'],
  [/^goals_\d+$/, 'meta'],
]

/** Unidad (clave de UNITS) para un id de lámina, o null si no se conoce. */
export function progressUnit(id) {
  for (const [re, unit] of UNIT_RULES) if (re.test(id || '')) return unit
  return null
}

/** "1 semana" / "4 semanas" (el plural lo decide el objetivo, como en "3 de 4 semanas"). */
function unitLabel(unit, n) {
  const pair = UNITS[unit]
  if (!pair) return ''
  return n === 1 ? pair[0] : pair[1]
}

/** ¿La lámina tiene un progreso que valga la pena mostrar? */
export function isMeasurable(a) {
  return !!a?.progress && a.progress.target > 1
}

/**
 * Texto de progreso: "3 de 4 semanas", "4.230 de 20.000 kcal".
 * `short` omite la unidad ("3 de 4"). null si no es medible.
 */
export function formatProgress(a, { short = false } = {}) {
  if (!isMeasurable(a)) return null
  const { current, target } = a.progress
  const base = `${NUM.format(current)} de ${NUM.format(target)}`
  if (short) return base
  const unit = progressUnit(a.id)
  return unit ? `${base} ${unitLabel(unit, target)}` : base
}

/** Proporción 0–1 del progreso (0 si no es medible). */
export function progressRatio(a) {
  if (!isMeasurable(a)) return 0
  return Math.max(0, Math.min(1, a.progress.current / a.progress.target))
}

const rarityOrder = (r) => RARITIES[r]?.order ?? 0

/**
 * "Lo que viene": las láminas sin ganar más cerca de pegarse, por proporción de
 * progreso (más avanzada primero); empates: la más común y luego el número del álbum.
 * Solo cuenta las que ya tienen algo de avance.
 * @param {object[]} list getAchievements(state, userId)
 * @param {number} [n=3]
 */
export function closestStickers(list, n = 3) {
  return (list || [])
    .filter((a) => !a.earned && isMeasurable(a) && a.progress.current > 0)
    .map((a) => ({ a, ratio: progressRatio(a) }))
    .sort((x, y) => y.ratio - x.ratio || rarityOrder(x.a.rarity) - rarityOrder(y.a.rarity) || x.a.number - y.a.number)
    .slice(0, n)
    .map((x) => x.a)
}

const DATE = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Fecha en que se ganó: "3 de noviembre de 2026", o null cuando no hay una fecha
 * real (láminas registradas en silencio desde el historial, o aún sin registrar).
 */
export function earnedDateLabel(a) {
  if (!a?.earned || a.seeded || !a.unlockedAt) return null
  return DATE.format(new Date(a.unlockedAt))
}

/** Las más recientes primero: devuelve "hoy", "ayer" o la fecha corta. */
export function shortDateLabel(ms, now = Date.now()) {
  if (!ms) return null
  const d = new Date(ms)
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(new Date(now)) - day(d)) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(d).replace('.', '')
}

/**
 * Comparación de la familia.
 * @param {{ id: string }[]} members
 * @param {(userId: string) => object[]} getList  getAchievements para cada uno
 * @returns {{ rows: Array<{ userId, earned, total, byRarity: Record<string,{earned,total}> }>,
 *   shared: number, owners: Record<string, string[]> }}
 *   shared = láminas que tienen todos; owners[id] = quiénes tienen cada lámina
 */
export function familyComparison(members, getList) {
  const owners = {}
  const rows = members.map((m) => {
    const list = getList(m.id) || []
    const byRarity = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, { earned: 0, total: 0 }]))
    let earned = 0
    for (const a of list) {
      const r = byRarity[a.rarity] || byRarity.comun
      r.total++
      if (a.earned) {
        r.earned++
        earned++
        ;(owners[a.id] ||= []).push(m.id)
      }
    }
    return { userId: m.id, earned, total: list.length, byRarity }
  })
  const shared = Object.values(owners).filter((ids) => ids.length === members.length).length
  return { rows, shared, owners }
}

/** Ids de quienes tienen una lámina (en el orden de la familia). */
export function ownersOf(members, getList, achievementId) {
  return members.filter((m) => (getList(m.id) || []).some((a) => a.id === achievementId && a.earned)).map((m) => m.id)
}

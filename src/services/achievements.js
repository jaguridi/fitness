/**
 * Achievements system — defines badges and checks if a user has earned them.
 * All computation is client-side based on existing Firestore data (summaries + workouts).
 * No additional collections needed.
 */
import { getBestDayStreak } from '../utils/streaks'

/**
 * Achievement definitions.
 * Each has: id, name, description, icon, and a `check` function that receives
 * { summaries, workouts, user } and returns true/false.
 */
export const ACHIEVEMENTS = [
  // ── Streak-based ─────────────────────────────────────────────
  {
    id: 'first_week',
    name: 'Primera Semana',
    description: 'Completa tu primera semana',
    icon: '🌱',
    category: 'streak',
    check: ({ summaries }) =>
      summaries.some((s) => s.status === 'completed' || s.lifeUsed),
  },
  {
    id: 'streak_4',
    name: 'Imparable',
    description: '4 semanas seguidas cumpliendo',
    icon: '🔥',
    category: 'streak',
    check: ({ summaries }) => getBestStreak(summaries) >= 4,
  },
  {
    id: 'streak_8',
    name: 'Máquina',
    description: '8 semanas seguidas cumpliendo',
    icon: '⚡',
    category: 'streak',
    check: ({ summaries }) => getBestStreak(summaries) >= 8,
  },
  {
    id: 'streak_12',
    name: 'Leyenda',
    description: '12 semanas seguidas cumpliendo',
    icon: '👑',
    category: 'streak',
    check: ({ summaries }) => getBestStreak(summaries) >= 12,
  },
  {
    id: 'day_streak_7',
    name: 'Semana Sin Fallar',
    description: '7 días consecutivos con ejercicio',
    icon: '⚡',
    category: 'streak',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 7,
  },
  {
    id: 'day_streak_14',
    name: 'Dos Semanas Brutales',
    description: '14 días consecutivos con ejercicio',
    icon: '🌩️',
    category: 'streak',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 14,
  },
  {
    id: 'day_streak_30',
    name: 'Mes Imparable',
    description: '30 días consecutivos con ejercicio',
    icon: '🚀',
    category: 'streak',
    check: ({ workouts }) => getBestDayStreak(workouts) >= 30,
  },

  // ── Volume-based ─────────────────────────────────────────────
  {
    id: 'sessions_10',
    name: 'Calentamiento',
    description: 'Registra 10 sesiones en total',
    icon: '🏋️',
    category: 'volume',
    check: ({ workouts }) => workouts.length >= 10,
  },
  {
    id: 'sessions_50',
    name: 'Medio Centenar',
    description: 'Registra 50 sesiones en total',
    icon: '💯',
    category: 'volume',
    check: ({ workouts }) => workouts.length >= 50,
  },
  {
    id: 'sessions_100',
    name: 'Centurión',
    description: '100 sesiones registradas',
    icon: '🏆',
    category: 'volume',
    check: ({ workouts }) => workouts.length >= 100,
  },

  // ── Minutes-based ────────────────────────────────────────────
  {
    id: 'long_session_60',
    name: 'Hora de Sudor',
    description: 'Completa una sesión de 60+ minutos',
    icon: '⏱️',
    category: 'minutes',
    check: ({ workouts }) => workouts.some((w) => (w.duration || 0) >= 60),
  },
  {
    id: 'long_session_90',
    name: 'Maratón',
    description: 'Completa una sesión de 90+ minutos',
    icon: '🏃‍♂️',
    category: 'minutes',
    check: ({ workouts }) => workouts.some((w) => (w.duration || 0) >= 90),
  },
  {
    id: 'long_session_120',
    name: 'Resistencia Pura',
    description: 'Completa una sesión de 2+ horas',
    icon: '🦾',
    category: 'minutes',
    check: ({ workouts }) => workouts.some((w) => (w.duration || 0) >= 120),
  },
  {
    id: 'total_minutes_500',
    name: '500 Minutos',
    description: 'Acumula 500 minutos totales de ejercicio',
    icon: '🎖️',
    category: 'minutes',
    check: ({ workouts }) => totalMinutes(workouts) >= 500,
  },
  {
    id: 'total_minutes_2000',
    name: 'Atleta Dedicado',
    description: 'Acumula 2.000 minutos totales (33 horas)',
    icon: '🏆',
    category: 'minutes',
    check: ({ workouts }) => totalMinutes(workouts) >= 2000,
  },
  {
    id: 'total_minutes_5000',
    name: 'Élite',
    description: 'Acumula 5.000 minutos totales (83 horas)',
    icon: '💎',
    category: 'minutes',
    check: ({ workouts }) => totalMinutes(workouts) >= 5000,
  },
  {
    id: 'avg_intensity',
    name: 'Intenso',
    description: 'Promedio de 45+ min por sesión (mín. 10 sesiones)',
    icon: '🔋',
    category: 'minutes',
    check: ({ workouts }) => {
      if (workouts.length < 10) return false
      return totalMinutes(workouts) / workouts.length >= 45
    },
  },
  {
    id: 'big_week_minutes',
    name: 'Semana Brutal',
    description: '300+ minutos en una sola semana',
    icon: '⚡',
    category: 'minutes',
    check: ({ workouts }) => {
      const byWeek = {}
      for (const w of workouts) {
        if (!w.weekId) continue
        byWeek[w.weekId] = (byWeek[w.weekId] || 0) + (w.duration || 0)
      }
      return Object.values(byWeek).some((m) => m >= 300)
    },
  },

  // ── Calories-based ───────────────────────────────────────────
  {
    id: 'first_burn',
    name: 'Primer Quemón',
    description: 'Registra calorías por primera vez',
    icon: '🔥',
    category: 'calories',
    check: ({ workouts }) => workouts.some((w) => (w.calories || 0) > 0),
  },
  {
    id: 'session_burn_500',
    name: 'Incinerador',
    description: 'Quema 500+ kcal en una sola sesión',
    icon: '🌶️',
    category: 'calories',
    check: ({ workouts }) => workouts.some((w) => (w.calories || 0) >= 500),
  },
  {
    id: 'session_burn_1000',
    name: 'Horno Industrial',
    description: 'Quema 1.000+ kcal en una sola sesión',
    icon: '🌋',
    category: 'calories',
    check: ({ workouts }) => workouts.some((w) => (w.calories || 0) >= 1000),
  },
  {
    id: 'total_burn_5000',
    name: '5K Quemadas',
    description: 'Acumula 5.000 kcal en total',
    icon: '♨️',
    category: 'calories',
    check: ({ workouts }) => totalCalories(workouts) >= 5000,
  },
  {
    id: 'total_burn_20000',
    name: 'Caldera',
    description: 'Acumula 20.000 kcal en total',
    icon: '🔥',
    category: 'calories',
    check: ({ workouts }) => totalCalories(workouts) >= 20000,
  },
  {
    id: 'total_burn_100000',
    name: 'Reactor Nuclear',
    description: 'Acumula 100.000 kcal en total',
    icon: '☢️',
    category: 'calories',
    check: ({ workouts }) => totalCalories(workouts) >= 100000,
  },
  {
    id: 'big_week_calories',
    name: 'Semana Volcánica',
    description: '3.000+ kcal en una sola semana',
    icon: '💥',
    category: 'calories',
    check: ({ workouts }) => {
      const byWeek = {}
      for (const w of workouts) {
        if (!w.weekId) continue
        byWeek[w.weekId] = (byWeek[w.weekId] || 0) + (w.calories || 0)
      }
      return Object.values(byWeek).some((c) => c >= 3000)
    },
  },

  // ── Variety-based ────────────────────────────────────────────
  {
    id: 'variety_3',
    name: 'Versátil',
    description: 'Prueba 3 tipos de ejercicio distintos',
    icon: '🎯',
    category: 'variety',
    check: ({ workouts }) => getUniqueExerciseTypes(workouts) >= 3,
  },
  {
    id: 'variety_6',
    name: 'Atleta Completo',
    description: 'Prueba 6 tipos de ejercicio distintos',
    icon: '🌈',
    category: 'variety',
    check: ({ workouts }) => getUniqueExerciseTypes(workouts) >= 6,
  },

  // ── Special ──────────────────────────────────────────────────
  {
    id: 'overachiever',
    name: 'Sobrehumano',
    description: 'Haz 5+ sesiones en una semana',
    icon: '🦸',
    category: 'special',
    check: ({ summaries }) =>
      summaries.some((s) => (s.sessions || 0) >= 5),
  },
  {
    id: 'shield_earned',
    name: 'Escudero',
    description: 'Gana tu primer escudo',
    icon: '🛡️',
    category: 'special',
    check: ({ summaries }) =>
      summaries.some((s) => s.shieldEarned),
  },
  {
    id: 'life_saver',
    name: 'Gato de 7 Vidas',
    description: 'Usa una vida extra para salvarte de la multa',
    icon: '❤️‍🩹',
    category: 'special',
    check: ({ summaries }) =>
      summaries.some((s) => s.lifeUsed),
  },
  {
    id: 'clean_record',
    name: 'Intachable',
    description: 'Nunca has pagado una multa',
    icon: '✨',
    category: 'special',
    check: ({ user }) => (user.walletBalance || 0) === 0,
  },
  {
    id: 'comeback',
    name: 'El Regreso',
    description: 'Cumple la semana después de haber pagado multa',
    icon: '🔄',
    category: 'special',
    check: ({ summaries }) => {
      const sorted = [...summaries].sort((a, b) => a.weekId.localeCompare(b.weekId))
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].status === 'missed' &&
            (sorted[i].status === 'completed' || sorted[i].lifeUsed)) {
          return true
        }
      }
      return false
    },
  },
  {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Completa la meta antes del jueves',
    icon: '🌅',
    category: 'special',
    check: ({ workouts, summaries }) => {
      // Group workouts by weekId, check if 3+ were logged by Wednesday
      const byWeek = {}
      for (const w of workouts) {
        if (!w.weekId || !w.date) continue
        if (!byWeek[w.weekId]) byWeek[w.weekId] = []
        byWeek[w.weekId].push(w)
      }
      return Object.entries(byWeek).some(([, weekWorkouts]) => {
        const earlyOnes = weekWorkouts.filter((w) => {
          const d = new Date(w.date + 'T12:00:00')
          return d.getDay() >= 1 && d.getDay() <= 3 // Mon-Wed
        })
        return earlyOnes.length >= 3
      })
    },
  },
]

// ── Helpers ──────────────────────────────────────────────────────

function getBestStreak(summaries) {
  let best = 0
  let cur = 0
  const sorted = [...summaries].sort((a, b) => a.weekId.localeCompare(b.weekId))
  for (const s of sorted) {
    if (s.status === 'completed' || s.lifeUsed) {
      cur++
      best = Math.max(best, cur)
    } else if (s.status !== 'frozen') {
      cur = 0
    }
  }
  return best
}

function totalMinutes(workouts) {
  return workouts.reduce((sum, w) => sum + (w.duration || 0), 0)
}

function totalCalories(workouts) {
  return workouts.reduce((sum, w) => sum + (w.calories || 0), 0)
}

function getUniqueExerciseTypes(workouts) {
  const set = new Set()
  for (const w of workouts) {
    if (Array.isArray(w.exerciseType)) {
      for (const t of w.exerciseType) if (t) set.add(t)
    } else if (w.exerciseType) {
      set.add(w.exerciseType)
    }
  }
  return set.size
}

/**
 * Check all achievements for a user.
 * @param {{ summaries: Array, workouts: Array, user: Object }} data
 * @returns {Array<{ ...achievement, earned: boolean }>}
 */
export function checkAchievements({ summaries, workouts, user }) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    earned: a.check({ summaries, workouts, user }),
  }))
}

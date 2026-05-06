/**
 * Achievements system — defines badges and checks if a user has earned them.
 * All computation is client-side based on existing Firestore data (summaries + workouts).
 * No additional collections needed.
 */

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

function getUniqueExerciseTypes(workouts) {
  return new Set(workouts.map((w) => w.exerciseType).filter(Boolean)).size
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

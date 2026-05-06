import { useState, useEffect } from 'react'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'

/**
 * Personal Bests — shows records and stats for a user.
 * Computed from existing workout and summary data.
 */
export default function PersonalBests({ userId }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    Promise.all([getUserSummaries(userId), getWorkoutsByUser(userId)])
      .then(([summaries, workouts]) => {
        if (cancelled) return
        setStats(computeStats(summaries, workouts))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  if (loading || !stats) return null

  const records = [
    { icon: '⏱️', label: 'Sesión más larga', value: stats.longestSession ? `${stats.longestSession} min` : '—', sub: stats.longestSessionType },
    { icon: '📅', label: 'Mejor semana', value: stats.bestWeekSessions ? `${stats.bestWeekSessions} sesiones` : '—', sub: stats.bestWeekId },
    { icon: '🔥', label: 'Mejor racha', value: stats.bestStreak ? `${stats.bestStreak} semanas` : '—', sub: null },
    { icon: '🏃', label: 'Total sesiones', value: `${stats.totalWorkouts}`, sub: `${stats.totalMinutes} min totales` },
    { icon: '💪', label: 'Ejercicio favorito', value: stats.favoriteExercise || '—', sub: stats.favoriteCount ? `${stats.favoriteCount} veces` : null },
    { icon: '🌈', label: 'Deportes probados', value: `${stats.uniqueTypes}`, sub: stats.uniqueTypes >= 6 ? 'Atleta completo' : `de ${stats.availableTypes}` },
  ]

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏅</span>
          <h3 className="font-bold text-white text-sm">Records personales</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-700/30">
        {records.map((r) => (
          <div key={r.label} className="bg-gray-800 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{r.icon}</span>
              <span className="text-xs text-gray-500">{r.label}</span>
            </div>
            <p className="text-lg font-bold text-white leading-tight">{r.value}</p>
            {r.sub && <p className="text-xs text-gray-500 mt-0.5">{r.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function computeStats(summaries, workouts) {
  // Longest session
  let longestSession = 0
  let longestSessionType = ''
  for (const w of workouts) {
    if ((w.duration || 0) > longestSession) {
      longestSession = w.duration
      longestSessionType = w.exerciseType || ''
    }
  }

  // Best week (most sessions)
  let bestWeekSessions = 0
  let bestWeekId = ''
  const sorted = [...summaries].sort((a, b) => a.weekId.localeCompare(b.weekId))
  for (const s of sorted) {
    if ((s.sessions || 0) > bestWeekSessions) {
      bestWeekSessions = s.sessions
      bestWeekId = s.weekId
    }
  }

  // Best streak
  let bestStreak = 0
  let cur = 0
  for (const s of sorted) {
    if (s.status === 'completed' || s.lifeUsed) {
      cur++
      bestStreak = Math.max(bestStreak, cur)
    } else if (s.status !== 'frozen') {
      cur = 0
    }
  }

  // Total workouts and minutes
  const totalWorkouts = workouts.length
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration || 0), 0)

  // Favorite exercise type
  const typeCounts = {}
  for (const w of workouts) {
    if (w.exerciseType) {
      typeCounts[w.exerciseType] = (typeCounts[w.exerciseType] || 0) + 1
    }
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  const favoriteExercise = sortedTypes[0]?.[0] || null
  const favoriteCount = sortedTypes[0]?.[1] || 0

  // Unique exercise types
  const uniqueTypes = new Set(workouts.map((w) => w.exerciseType).filter(Boolean)).size

  // Available types count (from constants — approximate)
  const availableTypes = 24

  return {
    longestSession,
    longestSessionType,
    bestWeekSessions,
    bestWeekId,
    bestStreak,
    totalWorkouts,
    totalMinutes,
    favoriteExercise,
    favoriteCount,
    uniqueTypes,
    availableTypes,
  }
}

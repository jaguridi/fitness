import { useState, useEffect } from 'react'
import { getExerciseTypes } from '../constants'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'
import { getCurrentDayStreak, getBestDayStreak } from '../utils/streaks'

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
    { icon: '⚡', label: 'Racha días', value: stats.currentDayStreak ? `${stats.currentDayStreak} días` : '—', sub: stats.bestDayStreak ? `Récord: ${stats.bestDayStreak}` : null },
    { icon: '🏃', label: 'Total sesiones', value: `${stats.totalWorkouts}`, sub: `${stats.totalMinutes} min totales` },
    { icon: '💪', label: 'Ejercicio favorito', value: stats.favoriteExercise || '—', sub: stats.favoriteCount ? `${stats.favoriteCount} veces` : null },
    { icon: '🌈', label: 'Deportes probados', value: `${stats.uniqueTypes}`, sub: stats.uniqueTypes >= 6 ? 'Atleta completo' : `de ${stats.availableTypes}` },
    ...(stats.totalCalories > 0
      ? [
          {
            icon: '♨️',
            label: 'Mayor quema',
            value: stats.biggestBurn ? `${stats.biggestBurn} kcal` : '—',
            sub: stats.biggestBurnType,
          },
          {
            icon: '🔥',
            label: 'Total kcal',
            value: `${stats.totalCalories.toLocaleString('es-CL')}`,
            sub: `${stats.workoutsWithCalories} sesión(es) registradas`,
          },
        ]
      : []),
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
      longestSessionType = getExerciseTypes(w).join(' + ')
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

  // Calories: biggest burn + total + count of workouts with calories
  let biggestBurn = 0
  let biggestBurnType = ''
  let totalCalories = 0
  let workoutsWithCalories = 0
  for (const w of workouts) {
    const cal = w.calories || 0
    if (cal > 0) {
      workoutsWithCalories++
      totalCalories += cal
      if (cal > biggestBurn) {
        biggestBurn = cal
        biggestBurnType = getExerciseTypes(w).join(' + ')
      }
    }
  }

  // Favorite exercise type — count each type separately (a workout with 2 types adds 1 to each)
  const typeCounts = {}
  for (const w of workouts) {
    for (const t of getExerciseTypes(w)) {
      typeCounts[t] = (typeCounts[t] || 0) + 1
    }
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  const favoriteExercise = sortedTypes[0]?.[0] || null
  const favoriteCount = sortedTypes[0]?.[1] || 0

  // Unique exercise types — flatten arrays
  const uniqueTypes = Object.keys(typeCounts).length

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
    biggestBurn,
    biggestBurnType,
    totalCalories,
    workoutsWithCalories,
    currentDayStreak: getCurrentDayStreak(workouts),
    bestDayStreak: getBestDayStreak(workouts),
  }
}

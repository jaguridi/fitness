import { useState, useEffect } from 'react'
import { USERS, formatCLP, getAvatarForMood, getExerciseTypes, getTotalPoints } from '../constants'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'
import Avatar from '../components/Avatar'
import MonthlyRecap from '../components/MonthlyRecap'
import { StatsSkeleton } from '../components/Skeleton'
import Card, { SectionCard } from '../components/ui/Card'

const MAX_BAR_H = 72 // px — max bar height in the chart
const TIMEFRAMES = [
  { id: 8, label: '8 sem' },
  { id: 12, label: '12 sem' },
  { id: 26, label: '26 sem' },
]
const DEFAULT_TIMEFRAME = 8

function barColor(status, lifeUsed) {
  if (lifeUsed) return 'bg-indigo-500'
  switch (status) {
    case 'completed': return 'bg-green-500'
    case 'missed':    return 'bg-red-500'
    case 'frozen':    return 'bg-gray-500'
    case 'justified': return 'bg-amber-500'
    default:          return 'bg-gray-700'
  }
}

function calcBestStreak(summaries) {
  let best = 0, cur = 0
  const sorted = [...summaries].sort((a, b) => a.weekId.localeCompare(b.weekId))
  for (const s of sorted) {
    if (s.status === 'completed' || s.lifeUsed) { cur++; best = Math.max(best, cur) }
    else if (s.status !== 'frozen') cur = 0
  }
  return best
}

export default function Stats({ gameState }) {
  const [summaries, setSummaries] = useState({}) // { userId: [summary,...] }
  const [allWorkouts, setAllWorkouts] = useState({}) // { userId: [workout,...] }
  const [selectedUser, setSelectedUser] = useState(USERS[0].id)
  const [sortBy, setSortBy] = useState('rate') // 'rate' | 'minutes' | 'avgMinutes' | 'calories'
  const [trendMetric, setTrendMetric] = useState('sessions') // 'sessions' | 'minutes' | 'calories'
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  const [loading, setLoading] = useState(true)

  const { users } = gameState

  useEffect(() => {
    async function load() {
      const sumResult = {}
      const wrkResult = {}
      await Promise.all(
        USERS.map(async (u) => {
          const [sums, wks] = await Promise.all([
            getUserSummaries(u.id),
            getWorkoutsByUser(u.id),
          ])
          sumResult[u.id] = sums
          wrkResult[u.id] = wks
        })
      )
      setSummaries(sumResult)
      setAllWorkouts(wrkResult)
      setLoading(false)
    }
    load()
  }, [])

  // ── Leaderboard ──────────────────────────────────────────────
  const leaderboard = USERS.map((u) => {
    const sums = summaries[u.id] || []
    const wks = allWorkouts[u.id] || []
    const firestoreUser = users.find((fu) => fu.id === u.id) || {}
    const userConst = USERS.find((c) => c.id === u.id)
    // Frozen weeks don't count toward compliance
    const scorable = sums.filter((s) => s.status !== 'frozen')
    const completed = scorable.filter((s) => s.status === 'completed' || s.lifeUsed).length
    const total = scorable.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Minutes-based stats
    const totalMins = wks.reduce((sum, w) => sum + (w.duration || 0), 0)
    const avgMins = wks.length > 0 ? Math.round(totalMins / wks.length) : 0

    // Calories-based stats (only counts workouts that registered calories)
    const totalCals = wks.reduce((sum, w) => sum + (w.calories || 0), 0)
    const sessionsWithCals = wks.filter((w) => (w.calories || 0) > 0).length

    // Fit points — duration-tiered scoring
    const totalPoints = getTotalPoints(wks)

    return {
      ...u,
      avatar: getAvatarForMood(userConst, firestoreUser),
      hasShield: firestoreUser.hasShield || false,
      completed,
      total,
      rate,
      fines: firestoreUser.walletBalance || 0,
      streak: firestoreUser.consecutiveSuccesses || 0,
      lives: firestoreUser.extraLives || 0,
      totalMins,
      avgMins,
      totalCals,
      sessionsWithCals,
      totalPoints,
      totalSessions: wks.length,
    }
  }).sort((a, b) => {
    if (sortBy === 'minutes') return b.totalMins - a.totalMins
    if (sortBy === 'avgMinutes') return b.avgMins - a.avgMins
    if (sortBy === 'calories') return b.totalCals - a.totalCals
    if (sortBy === 'points') return b.totalPoints - a.totalPoints
    return b.rate - a.rate || a.fines - b.fines
  })

  const medals = ['🥇', '🥈', '🥉', '']

  // ── Per-user chart ──────────────────────────────────────────
  const selSums = (summaries[selectedUser] || [])
    .sort((a, b) => a.weekId.localeCompare(b.weekId))
    .slice(-timeframe)

  const selFirestore = users.find((u) => u.id === selectedUser) || {}
  const totalSessions = selSums.reduce((s, w) => s + (w.sessions || 0), 0)
  const bestStreak = calcBestStreak(selSums)

  // Minutes-based stats for the selected user
  const selWorkouts = allWorkouts[selectedUser] || []
  const selTotalMins = selWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0)
  const selAvgMins = selWorkouts.length > 0 ? Math.round(selTotalMins / selWorkouts.length) : 0
  const selLongest = selWorkouts.reduce((max, w) => Math.max(max, w.duration || 0), 0)
  const selTotalCals = selWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0)

  // ── Weekly trend per metric (sessions/minutes/calories) ─────
  // Build weekId -> { sessions, minutes, calories } map for selected user
  const selWeekIds = selSums.map((s) => s.weekId)
  const selWeekTotals = {}
  for (const wid of selWeekIds) {
    selWeekTotals[wid] = { sessions: 0, minutes: 0, calories: 0 }
  }
  for (const w of selWorkouts) {
    if (!w.weekId || !selWeekTotals[w.weekId]) continue
    selWeekTotals[w.weekId].minutes += w.duration || 0
    selWeekTotals[w.weekId].calories += w.calories || 0
  }
  // Sessions come from summaries (more accurate; respects status logic)
  for (const s of selSums) {
    if (selWeekTotals[s.weekId]) selWeekTotals[s.weekId].sessions = s.sessions || 0
  }

  const trendData = selSums.map((s) => ({
    weekId: s.weekId,
    status: s.status,
    lifeUsed: s.lifeUsed,
    value: selWeekTotals[s.weekId]?.[trendMetric] || 0,
  }))
  const trendMax = Math.max(...trendData.map((d) => d.value), trendMetric === 'sessions' ? 3 : 1)
  // Trailing 4-week moving average for trend line
  const trendAvg = trendData.map((_, i) => {
    const window = trendData.slice(Math.max(0, i - 3), i + 1)
    return window.reduce((s, d) => s + d.value, 0) / window.length
  })

  // Format helpers for trend metric labels
  const fmtTrendValue = (v) => {
    if (trendMetric === 'minutes') return `${v}m`
    if (trendMetric === 'calories') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
    return `${v}`
  }
  const trendTotal = trendData.reduce((s, d) => s + d.value, 0)
  const trendAvgValue = trendData.length > 0 ? Math.round(trendTotal / trendData.length) : 0

  // ── Family aggregates ───────────────────────────────────────
  const familyTotals = USERS.reduce((acc, u) => {
    const wks = allWorkouts[u.id] || []
    const fu = users.find((fu) => fu.id === u.id) || {}
    acc.totalSessions += wks.length
    acc.totalMinutes += wks.reduce((s, w) => s + (w.duration || 0), 0)
    acc.totalCalories += wks.reduce((s, w) => s + (w.calories || 0), 0)
    acc.totalFines += fu.walletBalance || 0
    return acc
  }, { totalSessions: 0, totalMinutes: 0, totalCalories: 0, totalFines: 0 })

  // Top exercise type across the whole family
  const familyTypeCounts = {}
  USERS.forEach((u) => {
    (allWorkouts[u.id] || []).forEach((w) => {
      getExerciseTypes(w).forEach((t) => {
        familyTypeCounts[t] = (familyTypeCounts[t] || 0) + 1
      })
    })
  })
  const familyTopExercise = Object.entries(familyTypeCounts).sort((a, b) => b[1] - a[1])[0]

  // ── Multi-user weekly comparison chart ──────────────────────
  // Build a map of weekId -> { userId: sessions } for the selected timeframe
  const allWeekIds = new Set()
  USERS.forEach((u) => {
    (summaries[u.id] || []).forEach((s) => allWeekIds.add(s.weekId))
  })
  const sortedWeekIds = [...allWeekIds].sort().slice(-timeframe)
  const weekColors = {
    user1: '#6366f1', // indigo
    user2: '#ec4899', // pink
    user3: '#10b981', // emerald
    user4: '#f59e0b', // amber
  }
  const comparisonData = sortedWeekIds.map((wid) => {
    const point = { weekId: wid }
    USERS.forEach((u) => {
      const s = (summaries[u.id] || []).find((x) => x.weekId === wid)
      point[u.id] = s ? (s.sessions || 0) : 0
    })
    return point
  })
  const comparisonMax = Math.max(
    ...comparisonData.flatMap((d) => USERS.map((u) => d[u.id])),
    3,
  )

  // ── Exercise types per user (top 3) ─────────────────────────
  const exerciseDistribution = USERS.map((u) => {
    const counts = {}
    ;(allWorkouts[u.id] || []).forEach((w) => {
      getExerciseTypes(w).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1
      })
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((s, [, c]) => s + c, 0)
    const userConst = USERS.find((c) => c.id === u.id)
    const fu = users.find((x) => x.id === u.id) || {}
    return {
      ...u,
      avatar: getAvatarForMood(userConst, fu),
      top3: sorted.slice(0, 3).map(([type, count]) => ({
        type,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      })),
      total,
    }
  })

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white">📊 Estadísticas</h2>
          <p className="text-sm text-gray-400 mt-1">Rendimiento familiar</p>
        </div>
        <StatsSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">📊 Estadísticas</h2>
        <p className="text-sm text-gray-400 mt-1">Rendimiento familiar</p>
      </div>

      {/* Monthly recap (first week of each month only) */}
      <MonthlyRecap />

      {/* ── Family overview ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-2xl border border-indigo-700/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-indigo-700/30">
          <h3 className="font-bold text-white text-sm">👨‍👩‍👧‍👦 Total familia</h3>
        </div>
        <div className={`grid ${familyTotals.totalCalories > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-px bg-indigo-900/20`}>
          <div className="bg-gray-800/60 p-3 text-center">
            <p className="text-2xl font-bold text-white">{familyTotals.totalSessions}</p>
            <p className="text-xs text-gray-400">Sesiones totales</p>
          </div>
          <div className="bg-gray-800/60 p-3 text-center">
            <p className="text-2xl font-bold text-cyan-400">
              {Math.floor(familyTotals.totalMinutes / 60)}h
            </p>
            <p className="text-xs text-gray-400">Horas acumuladas</p>
          </div>
          {familyTotals.totalCalories > 0 && (
            <div className="bg-gray-800/60 p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">
                {familyTotals.totalCalories >= 1000
                  ? `${(familyTotals.totalCalories / 1000).toFixed(1)}k`
                  : familyTotals.totalCalories}
              </p>
              <p className="text-xs text-gray-400">🔥 kcal totales</p>
            </div>
          )}
          <div className="bg-gray-800/60 p-3 text-center">
            <p className="text-lg font-bold text-red-400">{formatCLP(familyTotals.totalFines)}</p>
            <p className="text-xs text-gray-400">Multas pagadas</p>
          </div>
          <div className="bg-gray-800/60 p-3 text-center">
            <p className="text-lg font-bold text-amber-400">
              {familyTopExercise ? familyTopExercise[0] : '—'}
            </p>
            <p className="text-xs text-gray-400">
              Deporte favorito {familyTopExercise && `(${familyTopExercise[1]}×)`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Leaderboard ─────────────────────────────────────── */}
      <SectionCard
        title="🏆 Clasificación familiar"
        aside={
          <div className="flex gap-1 flex-wrap justify-end">
            {[
              { id: 'rate', label: '%', title: 'Cumplimiento' },
              { id: 'points', label: 'Pts', title: 'Puntos ponderados por duración' },
              { id: 'minutes', label: 'Min', title: 'Total minutos' },
              { id: 'avgMinutes', label: 'Prom', title: 'Promedio min/sesión' },
              ...(familyTotals.totalCalories > 0
                ? [{ id: 'calories', label: 'kcal', title: 'Calorías totales' }]
                : []),
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                title={opt.title}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  sortBy === opt.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      >
        {leaderboard.map((u, i) => (
          <div
            key={u.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < leaderboard.length - 1 ? 'border-b border-gray-700/50' : ''
            }`}
          >
            <span className="text-lg w-5 shrink-0">{medals[i]}</span>
            <Avatar src={u.avatar} name={u.name} size="sm" hasShield={u.hasShield} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{u.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {sortBy === 'rate' ? (
                  <>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          u.rate >= 80 ? 'bg-green-500' : u.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${u.rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{u.rate}%</span>
                  </>
                ) : sortBy === 'minutes' ? (
                  (() => {
                    const max = Math.max(...leaderboard.map((x) => x.totalMins), 1)
                    const pct = Math.round((u.totalMins / max) * 100)
                    return (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 w-12 text-right">
                          {u.totalMins}m
                        </span>
                      </>
                    )
                  })()
                ) : sortBy === 'avgMinutes' ? (
                  (() => {
                    const max = Math.max(...leaderboard.map((x) => x.avgMins), 1)
                    const pct = Math.round((u.avgMins / max) * 100)
                    return (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 w-12 text-right">
                          {u.avgMins}m/s
                        </span>
                      </>
                    )
                  })()
                ) : sortBy === 'points' ? (
                  (() => {
                    const max = Math.max(...leaderboard.map((x) => x.totalPoints), 1)
                    const pct = Math.round((u.totalPoints / max) * 100)
                    return (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-yellow-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 w-14 text-right">
                          {u.totalPoints.toFixed(1)} pts
                        </span>
                      </>
                    )
                  })()
                ) : (
                  (() => {
                    const max = Math.max(...leaderboard.map((x) => x.totalCals), 1)
                    const pct = Math.round((u.totalCals / max) * 100)
                    return (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 w-14 text-right">
                          {u.totalCals >= 1000 ? `${(u.totalCals / 1000).toFixed(1)}k` : u.totalCals} kcal
                        </span>
                      </>
                    )
                  })()
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {sortBy === 'rate' ? (
                <>
                  <span className="text-xs text-gray-400">{u.completed}/{u.total} sem</span>
                  {u.fines > 0 && (
                    <span className="text-xs text-red-400">{formatCLP(u.fines)}</span>
                  )}
                </>
              ) : sortBy === 'calories' ? (
                <>
                  <span className="text-xs text-gray-400">{u.sessionsWithCals} ses.</span>
                  <span className="text-xs text-gray-500">
                    {u.sessionsWithCals > 0 ? Math.round(u.totalCals / u.sessionsWithCals) : 0} kcal/ses
                  </span>
                </>
              ) : sortBy === 'points' ? (
                <>
                  <span className="text-xs text-gray-400">{u.totalSessions} ses.</span>
                  <span className="text-xs text-gray-500">
                    {u.totalSessions > 0 ? (u.totalPoints / u.totalSessions).toFixed(2) : '0'} pts/ses
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-gray-400">{u.totalSessions} ses.</span>
                  <span className="text-xs text-gray-500">
                    {Math.floor(u.totalMins / 60)}h {u.totalMins % 60}m
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-1 text-sm shrink-0 min-w-[36px] justify-end">
              {u.lives > 0 && <span title={`${u.lives} vida(s)`}>❤️{u.lives > 1 ? u.lives : ''}</span>}
              {u.streak >= 2 && <span title={`${u.streak} sem. seguidas`}>🔥</span>}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* ── Timeframe selector ───────────────────────────────── */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs text-gray-500 mr-1">Ventana:</span>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.id}
            onClick={() => setTimeframe(tf.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              timeframe === tf.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* ── Multi-user weekly comparison ─────────────────────── */}
      <SectionCard
        title="📈 Comparación semanal"
        subtitle="Sesiones por semana — todos los miembros"
      >
        <div className="p-4">
          {comparisonData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin historial aún</p>
          ) : (
            <>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-3">
                {USERS.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: weekColors[u.id] }}
                    />
                    <span className="text-xs text-gray-400">{u.name}</span>
                  </div>
                ))}
              </div>

              {/* Grouped bar chart */}
              <div
                className="flex items-end justify-between gap-2 mb-2"
                style={{ height: '120px' }}
              >
                {comparisonData.map((d) => (
                  <div key={d.weekId} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-px w-full justify-center" style={{ height: '100px' }}>
                      {USERS.map((u) => {
                        const val = d[u.id] || 0
                        const h = Math.max(2, Math.round((val / comparisonMax) * 100))
                        return (
                          <div
                            key={u.id}
                            title={`${u.name}: ${val} ses.`}
                            className="flex-1 rounded-t-sm transition-all"
                            style={{ height: `${h}%`, backgroundColor: weekColors[u.id], minWidth: '4px' }}
                          />
                        )
                      })}
                    </div>
                    <span className="text-[10px] text-gray-600">
                      W{d.weekId.split('-W')[1]}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* ── Exercise distribution comparison ─────────────────── */}
      <SectionCard
        title="🎯 Top ejercicios por persona"
        subtitle="Los 3 deportes más practicados"
      >
        <div className="divide-y divide-gray-700/50">
          {exerciseDistribution.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3">
              <Avatar src={u.avatar} name={u.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm mb-1">{u.name}</p>
                {u.top3.length === 0 ? (
                  <p className="text-xs text-gray-500">Sin actividad aún</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {u.top3.map((t, i) => (
                      <span
                        key={t.type}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          i === 0
                            ? 'bg-amber-600/25 text-amber-300'
                            : i === 1
                            ? 'bg-gray-600/40 text-gray-300'
                            : 'bg-orange-700/25 text-orange-300'
                        }`}
                      >
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {t.type} ({t.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Per-user detail ──────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* User selector */}
        <div className="grid grid-cols-4 border-b border-gray-700">
          {USERS.map((u) => {
            const fu = users.find((x) => x.id === u.id) || {}
            const uc = USERS.find((c) => c.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u.id)}
                className={`py-2.5 flex flex-col items-center gap-1 transition-colors ${
                  selectedUser === u.id
                    ? 'bg-indigo-600/20 border-b-2 border-indigo-500'
                    : 'hover:bg-gray-700/50'
                }`}
              >
                <Avatar src={getAvatarForMood(uc, fu)} name={u.name} size="sm" />
                <span className="text-xs text-gray-400">{u.name}</span>
              </button>
            )
          })}
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-700">
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-white">{totalSessions}</p>
            <p className="text-xs text-gray-400">Sesiones</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-red-400">{formatCLP(selFirestore.walletBalance || 0)}</p>
            <p className="text-xs text-gray-400">Multas</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-green-400">{bestStreak}</p>
            <p className="text-xs text-gray-400">Mejor racha</p>
          </div>
        </div>

        {/* Minutes + Calories pills */}
        <div className={`grid ${selTotalCals > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 p-3 border-b border-gray-700`}>
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-cyan-400">
              {Math.floor(selTotalMins / 60)}h {selTotalMins % 60}m
            </p>
            <p className="text-xs text-gray-400">Total minutos</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-purple-400">{selAvgMins}</p>
            <p className="text-xs text-gray-400">Prom. min/ses.</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-amber-400">{selLongest}</p>
            <p className="text-xs text-gray-400">Sesión + larga</p>
          </div>
          {selTotalCals > 0 && (
            <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-orange-400">
                {selTotalCals >= 1000 ? `${(selTotalCals / 1000).toFixed(1)}k` : selTotalCals}
              </p>
              <p className="text-xs text-gray-400">🔥 kcal</p>
            </div>
          )}
        </div>

        {/* Trend chart header with metric toggle */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">📊 Tendencia</p>
            <p className="text-[11px] text-gray-500">
              {trendData.length} semana(s) · prom. {fmtTrendValue(trendAvgValue)}
            </p>
          </div>
          <div className="flex gap-1">
            {[
              { id: 'sessions', label: 'Ses.', color: 'green' },
              { id: 'minutes', label: 'Min', color: 'cyan' },
              ...(selTotalCals > 0 ? [{ id: 'calories', label: 'kcal', color: 'orange' }] : []),
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setTrendMetric(m.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  trendMetric === m.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trend chart — bars + moving average overlay */}
        <div className="px-4 pb-4">
          {trendData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin historial aún</p>
          ) : (
            <>
              <div className="relative" style={{ height: `${MAX_BAR_H + 28}px` }}>
                {/* Bars (use status color when showing sessions, otherwise metric color) */}
                <div className="flex items-end justify-between gap-1 absolute inset-0">
                  {trendData.map((d) => {
                    const barH = Math.max(2, Math.round((d.value / trendMax) * MAX_BAR_H))
                    const color =
                      trendMetric === 'sessions'
                        ? barColor(d.status, d.lifeUsed)
                        : trendMetric === 'minutes'
                        ? 'bg-cyan-500'
                        : 'bg-orange-500'
                    const weekNum = d.weekId.split('-W')[1]
                    return (
                      <div key={d.weekId} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                        <span className="text-[10px] text-gray-500 leading-none truncate w-full text-center">
                          {fmtTrendValue(d.value)}
                        </span>
                        <div
                          className={`w-full rounded-t-sm ${color} transition-all`}
                          style={{ height: `${barH}px` }}
                          title={`${d.weekId}: ${fmtTrendValue(d.value)}`}
                        />
                        <span className="text-[10px] text-gray-600">W{weekNum}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Moving average overlay (SVG polyline) */}
                {trendData.length >= 2 && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ paddingTop: '14px', paddingBottom: '14px' }}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <polyline
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      points={trendAvg
                        .map((v, i) => {
                          const x = trendData.length === 1
                            ? 50
                            : (i / (trendData.length - 1)) * 100
                          const y = 100 - (v / trendMax) * 100
                          return `${x.toFixed(2)},${y.toFixed(2)}`
                        })
                        .join(' ')}
                    />
                  </svg>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 items-center">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-3 h-0.5 bg-purple-400 inline-block" />
                  Prom. móvil 4 sem
                </span>
                {trendMetric === 'sessions' &&
                  [
                    ['bg-green-500', 'Cumplida'],
                    ['bg-indigo-500', 'Vida usada'],
                    ['bg-red-500', 'Multa'],
                    ['bg-amber-500', 'Justificada'],
                    ['bg-gray-500', 'Congelada'],
                  ].map(([color, label]) => (
                    <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className={`w-2 h-2 rounded-sm ${color} inline-block`} />
                      {label}
                    </span>
                  ))}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

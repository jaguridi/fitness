import { useState, useEffect } from 'react'
import { USERS, formatCLP, getAvatarForMood } from '../constants'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'
import Avatar from '../components/Avatar'
import { StatsSkeleton } from '../components/Skeleton'

const MAX_BAR_H = 72 // px — max bar height in the chart
const CHART_WEEKS = 8

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
  const [sortBy, setSortBy] = useState('rate') // 'rate' | 'minutes' | 'avgMinutes'
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
      totalSessions: wks.length,
    }
  }).sort((a, b) => {
    if (sortBy === 'minutes') return b.totalMins - a.totalMins
    if (sortBy === 'avgMinutes') return b.avgMins - a.avgMins
    return b.rate - a.rate || a.fines - b.fines
  })

  const medals = ['🥇', '🥈', '🥉', '']

  // ── Per-user chart ──────────────────────────────────────────
  const selSums = (summaries[selectedUser] || [])
    .sort((a, b) => a.weekId.localeCompare(b.weekId))
    .slice(-CHART_WEEKS)

  const maxSessions = Math.max(...selSums.map((s) => s.sessions || 0), 3)
  const selFirestore = users.find((u) => u.id === selectedUser) || {}
  const selConst = USERS.find((u) => u.id === selectedUser)
  const totalSessions = selSums.reduce((s, w) => s + (w.sessions || 0), 0)
  const bestStreak = calcBestStreak(selSums)

  // Minutes-based stats for the selected user
  const selWorkouts = allWorkouts[selectedUser] || []
  const selTotalMins = selWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0)
  const selAvgMins = selWorkouts.length > 0 ? Math.round(selTotalMins / selWorkouts.length) : 0
  const selLongest = selWorkouts.reduce((max, w) => Math.max(max, w.duration || 0), 0)

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

      {/* ── Leaderboard ─────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">🏆 Clasificación familiar</h3>
          {/* Sort selector */}
          <div className="flex gap-1">
            {[
              { id: 'rate', label: '%', title: 'Cumplimiento' },
              { id: 'minutes', label: 'Min', title: 'Total minutos' },
              { id: 'avgMinutes', label: 'Prom', title: 'Promedio min/sesión' },
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
        </div>
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
                ) : (
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
      </div>

      {/* ── Per-user detail ──────────────────────────────────── */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
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

        {/* Minutes pills */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-700">
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
        </div>

        {/* Bar chart */}
        <div className="p-4">
          <p className="text-xs text-gray-500 mb-3">
            Últimas {selSums.length > 0 ? selSums.length : 0} semanas procesadas
          </p>
          {selSums.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin historial aún</p>
          ) : (
            <>
              <div
                className="flex items-end justify-between gap-1"
                style={{ height: `${MAX_BAR_H + 28}px` }}
              >
                {selSums.map((s) => {
                  const barH = Math.max(4, Math.round((s.sessions / maxSessions) * MAX_BAR_H))
                  const color = barColor(s.status, s.lifeUsed)
                  const weekNum = s.weekId.split('-W')[1]
                  const icon = s.status === 'justified' ? '⚖️'
                    : s.status === 'frozen' ? '❄️'
                    : s.lifeUsed ? '❤️'
                    : null
                  return (
                    <div key={s.weekId} className="flex-1 flex flex-col items-center gap-0.5">
                      {icon
                        ? <span className="text-xs leading-none">{icon}</span>
                        : <span className="text-xs text-gray-500">{s.sessions}</span>
                      }
                      <div
                        className={`w-full rounded-t-sm ${color}`}
                        style={{ height: `${barH}px` }}
                      />
                      <span className="text-xs text-gray-600">W{weekNum}</span>
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                {[
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
      </div>
    </div>
  )
}

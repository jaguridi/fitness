import { useState, useEffect } from 'react'
import { USERS, formatCLP, getAvatarForMood } from '../constants'
import { getUserSummaries } from '../services/firebaseService'
import Avatar from '../components/Avatar'

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
  const [selectedUser, setSelectedUser] = useState(USERS[0].id)
  const [loading, setLoading] = useState(true)

  const { users } = gameState

  useEffect(() => {
    async function load() {
      const result = {}
      await Promise.all(
        USERS.map(async (u) => {
          result[u.id] = await getUserSummaries(u.id)
        })
      )
      setSummaries(result)
      setLoading(false)
    }
    load()
  }, [])

  // ── Leaderboard ──────────────────────────────────────────────
  const leaderboard = USERS.map((u) => {
    const sums = summaries[u.id] || []
    const firestoreUser = users.find((fu) => fu.id === u.id) || {}
    const userConst = USERS.find((c) => c.id === u.id)
    // Frozen weeks don't count toward compliance
    const scorable = sums.filter((s) => s.status !== 'frozen')
    const completed = scorable.filter((s) => s.status === 'completed' || s.lifeUsed).length
    const total = scorable.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
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
    }
  }).sort((a, b) => b.rate - a.rate || a.fines - b.fines)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-bounce">📊</div>
          <p className="text-gray-400">Cargando estadísticas...</p>
        </div>
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
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="font-bold text-white text-sm">🏆 Clasificación familiar</h3>
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
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      u.rate >= 80 ? 'bg-green-500' : u.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${u.rate}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{u.rate}%</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-xs text-gray-400">{u.completed}/{u.total} sem</span>
              {u.fines > 0 && (
                <span className="text-xs text-red-400">{formatCLP(u.fines)}</span>
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
                  return (
                    <div key={s.weekId} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-xs text-gray-500">{s.sessions}</span>
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

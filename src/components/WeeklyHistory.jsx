import { useState, useEffect } from 'react'
import { USERS, formatCLP } from '../constants'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'
import { formatWeekLabel } from '../hooks/useWeekId'
import Avatar from './Avatar'

export default function WeeklyHistory() {
  const [selectedUser, setSelectedUser] = useState(USERS[0].id)
  const [summaries, setSummaries] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      getUserSummaries(selectedUser),
      getWorkoutsByUser(selectedUser),
    ]).then(([sums, wks]) => {
      if (!cancelled) {
        setSummaries(sums)
        setWorkouts(wks)
        setLoading(false)
      }
    }).catch((err) => {
      console.error('WeeklyHistory load error:', err)
      if (!cancelled) {
        setSummaries([])
        setWorkouts([])
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [selectedUser])

  const statusLabel = (status) => {
    switch (status) {
      case 'completed': return { text: 'Cumplida', color: 'text-green-400' }
      case 'missed': return { text: 'Multada', color: 'text-red-400' }
      case 'frozen': return { text: 'Congelada', color: 'text-blue-400' }
      default: return { text: status, color: 'text-gray-400' }
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">📊 Historial Semanal</h3>

      {/* User selector */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {USERS.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUser(u.id)}
            className={`p-2 rounded-xl text-center transition-all ${
              selectedUser === u.id
                ? 'bg-indigo-600 ring-2 ring-indigo-400'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Avatar src={u.avatar} name={u.name} size="sm" />
            <div className="text-xs mt-1 text-gray-300 truncate">{u.name}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-4">Cargando...</p>
      ) : summaries.length === 0 ? (
        <p className="text-gray-400 text-center py-4">Sin historial aún.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {summaries.map((s) => {
            const st = statusLabel(s.status)
            return (
              <div
                key={s.id}
                className="flex items-center justify-between bg-gray-900/50 rounded-xl px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {formatWeekLabel(s.weekId)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.sessions} sesiones
                    {s.lifeUsed && ' | ❤️ Vida usada'}
                    {s.lifeEarned && ' | 🌟 Vida ganada'}
                    {s.shieldEarned && ' | 🛡️ Escudo ganado'}
                    {s.shieldBroken && ' | 💔 Escudo roto'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${st.color}`}>{st.text}</p>
                  {s.fineApplied > 0 && (
                    <p className="text-xs text-red-400">{formatCLP(s.fineApplied)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent workouts */}
      {workouts.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">
            Últimos entrenamientos
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {workouts.slice(0, 10).map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 bg-gray-900/50 rounded-xl px-3 py-2"
              >
                {w.photoURL && (
                  <img
                    src={w.photoURL}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{w.exerciseType}</p>
                  <p className="text-xs text-gray-400">
                    {w.date} · {w.duration} min
                  </p>
                  {w.description && (
                    <p className="text-xs text-gray-500 truncate">{w.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

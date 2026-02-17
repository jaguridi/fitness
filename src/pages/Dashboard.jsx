import { useState } from 'react'
import { USERS } from '../constants'
import { formatWeekLabel } from '../hooks/useWeekId'
import UserCard from '../components/UserCard'
import PotCounter from '../components/PotCounter'
import WallOfShame from '../components/WallOfShame'
import WorkoutLogger from '../components/WorkoutLogger'

export default function Dashboard({ gameState }) {
  const [showLogger, setShowLogger] = useState(false)

  const {
    users,
    totalPot,
    currentWeekId,
    getUserWeekStatus,
    loading,
    error,
  } = gameState

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-bounce">💪</div>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold mb-2">Error de conexión</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const statuses = USERS.map((u) => getUserWeekStatus(u.id)).filter(Boolean)

  return (
    <div className="space-y-4 pb-24">
      {/* Week header */}
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">FitFamily</h2>
        <p className="text-sm text-gray-400 mt-1">
          📅 {formatWeekLabel(currentWeekId)}
        </p>
      </div>

      {/* Pot */}
      <PotCounter total={totalPot} />

      {/* User cards */}
      <div className="space-y-3">
        {statuses.map((status) => (
          <UserCard key={status.userId} status={status} />
        ))}
      </div>

      {/* Wall of shame */}
      <WallOfShame users={users} />

      {/* FAB - Register workout */}
      <button
        onClick={() => setShowLogger(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-2xl flex items-center justify-center text-3xl active:scale-90 transition-all z-40"
        aria-label="Registrar ejercicio"
      >
        ➕
      </button>

      {/* Workout Logger Modal */}
      {showLogger && (
        <WorkoutLogger
          onClose={() => setShowLogger(false)}
          onSuccess={() => setShowLogger(false)}
        />
      )}
    </div>
  )
}

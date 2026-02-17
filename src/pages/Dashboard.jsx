import { useState, useEffect } from 'react'
import { USERS } from '../constants'
import { formatWeekLabel } from '../hooks/useWeekId'
import { useAuth } from '../context/AuthContext'
import { getJustification } from '../services/firebaseService'
import UserCard from '../components/UserCard'
import PotCounter from '../components/PotCounter'
import WallOfShame from '../components/WallOfShame'
import WorkoutLogger from '../components/WorkoutLogger'
import JustificationModal from '../components/JustificationModal'

export default function Dashboard({ gameState }) {
  const { currentUser } = useAuth()
  const [showLogger, setShowLogger] = useState(false)
  const [showJustification, setShowJustification] = useState(false)
  const [hasJustification, setHasJustification] = useState(false)

  const {
    users,
    totalPot,
    currentWeekId,
    getUserWeekStatus,
    loading,
    error,
  } = gameState

  // Check if current user already submitted a justification for this week
  useEffect(() => {
    if (currentUser?.id && currentWeekId) {
      getJustification(currentUser.id, currentWeekId).then((j) => {
        setHasJustification(!!j)
      }).catch(() => {})
    }
  }, [currentUser?.id, currentWeekId])

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

      {/* Justification banner — shows if current user hasn't met goal and hasn't submitted */}
      {currentUser && (() => {
        const myStatus = getUserWeekStatus(currentUser.id)
        if (myStatus && !myStatus.goalMet && !myStatus.frozen && !hasJustification) {
          return (
            <button
              onClick={() => setShowJustification(true)}
              className="w-full bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4 text-left hover:bg-amber-900/30 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚖️</span>
                <div>
                  <p className="font-semibold text-amber-300">¿No vas a cumplir esta semana?</p>
                  <p className="text-xs text-amber-400/70">
                    Si tienes un imprevisto, envía tu justificación al Juez IA
                  </p>
                </div>
              </div>
            </button>
          )
        }
        if (myStatus && !myStatus.goalMet && !myStatus.frozen && hasJustification) {
          return (
            <div className="bg-amber-900/10 border border-amber-700/20 rounded-2xl p-3 text-center">
              <p className="text-amber-400 text-sm">⚖️ Ya enviaste tu justificación para esta semana</p>
            </div>
          )
        }
        return null
      })()}

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

      {/* Justification Modal */}
      {showJustification && (
        <JustificationModal
          weekId={currentWeekId}
          onClose={() => setShowJustification(false)}
          onResult={(verdict) => {
            setHasJustification(true)
          }}
        />
      )}
    </div>
  )
}

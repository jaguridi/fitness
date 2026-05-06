import { useState, useEffect, useRef, useCallback } from 'react'
import { USERS, WEEKLY_GOAL, EXTRA_LIFE_THRESHOLD } from '../constants'
import { formatWeekLabel } from '../hooks/useWeekId'
import { useAuth } from '../context/AuthContext'
import { getJustification, getJustificationsForWeek, subscribePendingJustifications } from '../services/firebaseService'
import UserCard from '../components/UserCard'
import PotCounter from '../components/PotCounter'
import WallOfShame from '../components/WallOfShame'
import WorkoutLogger from '../components/WorkoutLogger'
import JustificationModal from '../components/JustificationModal'
import JustificationVoteCard from '../components/JustificationVoteCard'
import EasterEgg from '../components/EasterEgg'
import MiniGame from '../components/MiniGame'
import WeeklyRecap from '../components/WeeklyRecap'
import Confetti from '../components/Confetti'
import { DashboardSkeleton } from '../components/Skeleton'

export default function Dashboard({ gameState }) {
  const { currentUser } = useAuth()
  const [showLogger, setShowLogger] = useState(false)
  const [celebration, setCelebration] = useState(null) // 'goal' | 'life' | 'shield' | 'overachiever' | null
  const [showJustification, setShowJustification] = useState(false)
  const [existingJustification, setExistingJustification] = useState(null) // null = no justification, object = existing
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const [showMiniGame, setShowMiniGame] = useState(false)
  const [pendingJustifications, setPendingJustifications] = useState([])
  const [weekJustifications, setWeekJustifications] = useState([])

  // Subscribe to pending justification votes
  useEffect(() => {
    const unsub = subscribePendingJustifications(
      (data) => setPendingJustifications(data),
      (err) => console.error('pending justifications error:', err)
    )
    return unsub
  }, [])

  // Easter egg: tap "FitFamily" heading 7 times within 3 seconds
  const eggTaps = useRef(0)
  const eggTimer = useRef(null)
  const handleTitleTap = () => {
    eggTaps.current += 1
    clearTimeout(eggTimer.current)
    if (eggTaps.current >= 7) {
      eggTaps.current = 0
      setShowEasterEgg(true)
      return
    }
    eggTimer.current = setTimeout(() => { eggTaps.current = 0 }, 3000)
  }

  // Easter egg 2: tap the pot 10 times within 5 seconds → mini-game
  const gameTaps = useRef(0)
  const gameTimer = useRef(null)
  const handlePotTap = () => {
    gameTaps.current += 1
    clearTimeout(gameTimer.current)
    if (gameTaps.current >= 10) {
      gameTaps.current = 0
      setShowMiniGame(true)
      return
    }
    gameTimer.current = setTimeout(() => { gameTaps.current = 0 }, 5000)
  }

  const {
    users,
    totalPot,
    currentWeekId,
    getUserWeekStatus,
    getSessionCount,
    getRecoverySessions,
    isWeekFrozen,
    loading,
    error,
  } = gameState

  // Detect celebration type after logging a workout
  const detectCelebration = useCallback(() => {
    if (!currentUser) return
    const sessions = getSessionCount(currentUser.id) + 1 // +1 for the just-logged one
    const recovery = getRecoverySessions(currentUser.id)
    const frozen = isWeekFrozen(currentUser.id)
    if (frozen) return

    const totalRequired = WEEKLY_GOAL + recovery
    const user = users.find((u) => u.id === currentUser.id)
    const consecutiveSuccesses = (user?.consecutiveSuccesses || 0)

    if (sessions >= EXTRA_LIFE_THRESHOLD + recovery) {
      setCelebration('overachiever')
    } else if (sessions === totalRequired && consecutiveSuccesses >= 3) {
      // Will earn shield at week-end (4th consecutive success)
      setCelebration('shield')
    } else if (sessions === totalRequired) {
      setCelebration('goal')
    }
  }, [currentUser, getSessionCount, getRecoverySessions, isWeekFrozen, users])

  // Check if current user already submitted a justification for this week
  useEffect(() => {
    if (currentUser?.id && currentWeekId) {
      getJustification(currentUser.id, currentWeekId).then((j) => {
        setExistingJustification(j) // null if none, object if exists
      }).catch(() => {})
    }
  }, [currentUser?.id, currentWeekId])

  // Load all justifications for the current week (for UserCard badges)
  useEffect(() => {
    if (currentWeekId) {
      getJustificationsForWeek(currentWeekId).then(setWeekJustifications).catch(() => {})
    }
  }, [currentWeekId, existingJustification])

  // Refresh justification after modal closes
  const refreshJustification = () => {
    if (currentUser?.id && currentWeekId) {
      getJustification(currentUser.id, currentWeekId).then((j) => {
        setExistingJustification(j)
      }).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white">FitFamily</h2>
          <p className="text-sm text-gray-400 mt-1">📅 Cargando semana...</p>
        </div>
        <DashboardSkeleton />
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
      {/* Week header — tap title 7× to unlock secret mode */}
      <div className="text-center">
        <h2
          className="text-2xl font-black text-white select-none cursor-default"
          onClick={handleTitleTap}
        >
          FitFamily
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          📅 {formatWeekLabel(currentWeekId)}
        </p>
      </div>

      {/* Pot — tap 10× to unlock mini-game */}
      <div onClick={handlePotTap} className="select-none">
        <PotCounter total={totalPot} />
      </div>

      {/* AI Weekly Recap */}
      <WeeklyRecap currentWeekId={currentWeekId} />

      {/* User cards */}
      <div className="space-y-3">
        {statuses.map((status) => (
          <UserCard
            key={status.userId}
            status={status}
            justification={weekJustifications.find((j) => j.userId === status.userId)}
          />
        ))}
      </div>

      {/* Justification banner */}
      {currentUser && (() => {
        const myStatus = getUserWeekStatus(currentUser.id)
        if (!myStatus || myStatus.goalMet || myStatus.frozen) return null

        // No justification yet → offer to create one
        if (!existingJustification) {
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

        // Pending vote → show voting status
        if (existingJustification.status === 'pending_vote') {
          return (
            <JustificationVoteCard
              justification={existingJustification}
              currentUserId={currentUser.id}
            />
          )
        }

        // Has justification that was REJECTED (by AI or by vote) → offer to appeal
        if (existingJustification.aiVerdict === false) {
          return (
            <button
              onClick={() => setShowJustification(true)}
              className="w-full bg-red-900/20 border border-red-700/30 rounded-2xl p-4 text-left hover:bg-red-900/30 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-semibold text-red-300">Justificación rechazada</p>
                  <p className="text-xs text-red-400/70">
                    Puedes editar y apelar tu justificación
                  </p>
                </div>
              </div>
              <div className="mt-2 bg-red-900/30 rounded-xl p-2">
                <p className="text-xs text-red-300 truncate">🤖 {existingJustification.aiReason}</p>
              </div>
            </button>
          )
        }

        // Has justification that was ACCEPTED → show confirmation
        if (existingJustification.aiVerdict === true) {
          return (
            <div className="bg-green-900/10 border border-green-700/20 rounded-2xl p-3 text-center">
              <p className="text-green-400 text-sm">✅ Justificación aceptada — multa congelada esta semana</p>
            </div>
          )
        }

        return null
      })()}

      {/* Pending justification votes from other family members */}
      {currentUser && pendingJustifications
        .filter((j) => j.userId !== currentUser.id)
        .map((j) => (
          <JustificationVoteCard
            key={j.id}
            justification={j}
            currentUserId={currentUser.id}
          />
        ))
      }

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
          onSuccess={() => {
            detectCelebration()
            setShowLogger(false)
          }}
        />
      )}

      {/* Confetti celebration */}
      {celebration && (
        <Confetti type={celebration} onDone={() => setCelebration(null)} />
      )}

      {/* Justification Modal */}
      {showJustification && (
        <JustificationModal
          weekId={currentWeekId}
          existing={existingJustification?.aiVerdict === false || existingJustification?.status === 'pending_vote' ? existingJustification : null}
          onClose={() => {
            setShowJustification(false)
            refreshJustification()
          }}
          onResult={(verdict) => {
            refreshJustification()
          }}
        />
      )}

      {/* 🎉 Easter egg — unlocked by tapping "FitFamily" 7 times */}
      {showEasterEgg && (
        <EasterEgg
          users={users}
          onClose={() => setShowEasterEgg(false)}
        />
      )}

      {/* 🎮 Easter egg 2 — unlocked by tapping pot 10 times */}
      {showMiniGame && (
        <MiniGame
          currentUser={currentUser}
          onClose={() => setShowMiniGame(false)}
        />
      )}
    </div>
  )
}

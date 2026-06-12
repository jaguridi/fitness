import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCLP, EXTRAS_PER_FINE_REDEMPTION, FINE_REDEMPTION_AMOUNT } from '../constants'
import { useAuth } from '../context/AuthContext'
import { sendNudge, getWorkoutsByUser } from '../services/firebaseService'
import { getCurrentDayStreak } from '../utils/streaks'
import Avatar from './Avatar'
import AchievementBadges from './AchievementBadges'
import Card from './ui/Card'

export default function UserCard({ status, justification }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [nudging, setNudging] = useState(false)
  const [nudgeMsg, setNudgeMsg] = useState(null)
  const [dayStreak, setDayStreak] = useState(0)

  // Fetch user workouts to compute the consecutive-day streak.
  // Cached locally so reloads on the same day don't refetch from network.
  useEffect(() => {
    if (!status?.userId) return
    let cancelled = false
    getWorkoutsByUser(status.userId)
      .then((wks) => {
        if (!cancelled) setDayStreak(getCurrentDayStreak(wks))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [status?.userId, status?.sessions])

  if (!status) return null
  const {
    userId, user, sessions, totalRequired, frozen, partiallyFrozen,
    frozenSessions, goalMet, progress, canEarnLife,
    inRecoveryWindow, remainingDebt, debtConsumedThisWeek,
    bankedExtras = 0, bankedExtrasProjected = 0,
  } = status

  const progressPct = Math.round(progress * 100)
  const hearts = '❤️'.repeat(user.extraLives || 0)
  const emptyHearts = '🤍'.repeat(Math.max(0, 3 - (user.extraLives || 0)))

  return (
    <Card
      onClick={() => navigate(`/user/${userId}`)}
      className="p-4 shadow-lg cursor-pointer hover:border-indigo-500/50 transition-all active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={user.avatar} name={user.name} size="md" hasShield={user.hasShield} />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-white">{user.name}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span>{hearts}{emptyHearts}</span>
            <AchievementBadges userId={userId} user={user} mode="compact" />
          </div>
        </div>
        {frozen && (
          <span className="bg-cyan-600/20 text-cyan-400 text-xs font-semibold px-2 py-1 rounded-full">
            ❄️ Semana congelada
          </span>
        )}
        {partiallyFrozen && !frozen && (
          <span
            className="bg-cyan-600/20 text-cyan-400 text-xs font-semibold px-2 py-1 rounded-full"
            title={`${frozenSessions} sesión(es) congelada(s)`}
          >
            ❄️ -{frozenSessions}
          </span>
        )}
        {goalMet && !frozen && (
          <span className="bg-green-600/20 text-green-400 text-xs font-semibold px-2 py-1 rounded-full">
            ✅ Meta
          </span>
        )}
        {!frozen && !goalMet && justification?.aiVerdict === true && (
          <span className="bg-amber-600/20 text-amber-400 text-xs font-semibold px-2 py-1 rounded-full">
            ⚖️ Justificada
          </span>
        )}
        {!frozen && !goalMet && justification?.status === 'pending_vote' && (
          <span className="bg-amber-600/20 text-amber-400 text-xs font-semibold px-2 py-1 rounded-full animate-pulse">
            🗳️ En votación
          </span>
        )}
        {!frozen && !goalMet && justification?.aiVerdict === false && justification?.status !== 'pending_vote' && (
          <span className="bg-red-600/20 text-red-400 text-xs font-semibold px-2 py-1 rounded-full">
            ❌ Rechazada
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Sesiones esta semana</span>
          <span className="font-mono font-bold text-white">
            {sessions}/{totalRequired}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              goalMet
                ? 'bg-green-500'
                : progress >= 0.66
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Extras bank — only show when there's something to display */}
      {bankedExtrasProjected > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-emerald-400">🏦 Extras ahorrados</span>
            <span className="font-mono font-bold text-emerald-300">
              {bankedExtras}
              {bankedExtrasProjected !== bankedExtras && (
                <span className="text-emerald-500/70 font-normal"> (+{bankedExtrasProjected - bankedExtras} esta semana)</span>
              )}
              <span className="text-gray-500 font-normal"> / {EXTRAS_PER_FINE_REDEMPTION}</span>
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (bankedExtrasProjected % EXTRAS_PER_FINE_REDEMPTION) / EXTRAS_PER_FINE_REDEMPTION * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 leading-tight mt-1">
            Cada {EXTRAS_PER_FINE_REDEMPTION} extras borran {formatCLP(FINE_REDEMPTION_AMOUNT)} de multa al cierre de semana.
          </p>
        </div>
      )}

      {/* Recovery debt counter — only when inside a recovery window with debt left */}
      {inRecoveryWindow && remainingDebt > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-cyan-400">🔄 Recuperación pendiente</span>
            <span className="font-mono font-bold text-cyan-300">
              {remainingDebt} ses.
            </span>
          </div>
          <p className="text-[11px] text-gray-500 leading-tight">
            {debtConsumedThisWeek > 0 && `Pagaste ${debtConsumedThisWeek} esta semana. `}
            Cada sesión sobre la meta semanal dentro del rango ±3 baja la deuda.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>
          Multa acumulada:{' '}
          <span className="text-red-400 font-semibold">
            {formatCLP(user.walletBalance || 0)}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {dayStreak >= 2 && (
            <span
              className="font-semibold text-pink-400"
              title={`${dayStreak} días consecutivos con ejercicio`}
            >
              ⚡ {dayStreak}d
            </span>
          )}
          {(user.consecutiveSuccesses || 0) > 0 && (
            <span className={`font-semibold ${user.hasShield ? 'text-cyan-400' : 'text-orange-400'}`}>
              🔥 {user.consecutiveSuccesses} {user.hasShield && '🛡️'}
            </span>
          )}
          {canEarnLife && (
            <span className="text-yellow-400 font-semibold">🌟 +1 vida</span>
          )}
        </div>
      </div>

      {/* Nudge button — show for other users who haven't met goal */}
      {currentUser && currentUser.id !== userId && !goalMet && !frozen && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          {nudgeMsg ? (
            <p className={`text-xs text-center ${nudgeMsg.ok ? 'text-green-400' : 'text-amber-400'}`}>
              {nudgeMsg.text}
            </p>
          ) : (
            <button
              disabled={nudging}
              onClick={(e) => {
                e.stopPropagation()
                setNudging(true)
                sendNudge(userId, currentUser.name)
                  .then(() => setNudgeMsg({ ok: true, text: '👊 ¡Empujón enviado!' }))
                  .catch((err) => setNudgeMsg({ ok: false, text: err.message }))
                  .finally(() => {
                    setNudging(false)
                    setTimeout(() => setNudgeMsg(null), 4000)
                  })
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold bg-amber-600/15 text-amber-400 hover:bg-amber-600/25 transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              {nudging ? '⏳ Enviando...' : '👊 Enviar empujón'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

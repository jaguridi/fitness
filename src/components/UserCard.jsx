import { useNavigate } from 'react-router-dom'
import { formatCLP } from '../constants'
import Avatar from './Avatar'

export default function UserCard({ status }) {
  const navigate = useNavigate()

  if (!status) return null
  const { userId, user, sessions, totalRequired, frozen, goalMet, progress, canEarnLife } = status

  const progressPct = Math.round(progress * 100)
  const hearts = '❤️'.repeat(user.extraLives || 0)
  const emptyHearts = '🤍'.repeat(Math.max(0, 3 - (user.extraLives || 0)))

  return (
    <div
      onClick={() => navigate(`/user/${userId}`)}
      className="bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-700 cursor-pointer hover:border-indigo-500/50 transition-all active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={user.avatar} name={user.name} size="md" hasShield={user.hasShield} />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-white">{user.name}</h3>
          <div className="text-sm">
            {hearts}{emptyHearts}
          </div>
        </div>
        {frozen && (
          <span className="bg-blue-600/20 text-blue-400 text-xs font-semibold px-2 py-1 rounded-full">
            ❄️ Ausencia
          </span>
        )}
        {goalMet && !frozen && (
          <span className="bg-green-600/20 text-green-400 text-xs font-semibold px-2 py-1 rounded-full">
            ✅ Meta
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

      {/* Stats row */}
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>
          Multa acumulada:{' '}
          <span className="text-red-400 font-semibold">
            {formatCLP(user.walletBalance || 0)}
          </span>
        </span>
        <div className="flex items-center gap-2">
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
    </div>
  )
}

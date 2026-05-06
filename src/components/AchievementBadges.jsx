import { useState, useEffect } from 'react'
import { checkAchievements } from '../services/achievements'
import { getUserSummaries, getWorkoutsByUser } from '../services/firebaseService'

/**
 * Display achievements for a user.
 * @param {string} userId - The user ID to check achievements for
 * @param {Object} user - Firestore user data (for walletBalance, etc.)
 * @param {'compact'|'full'} mode - compact shows only earned, full shows all
 */
export default function AchievementBadges({ userId, user, mode = 'compact' }) {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    Promise.all([getUserSummaries(userId), getWorkoutsByUser(userId)])
      .then(([summaries, workouts]) => {
        if (cancelled) return
        const results = checkAchievements({ summaries, workouts, user: user || {} })
        setAchievements(results)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('Achievements check failed:', err)
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId, user?.walletBalance, user?.consecutiveSuccesses])

  if (loading) return null

  const earned = achievements.filter((a) => a.earned)
  const locked = achievements.filter((a) => !a.earned)

  if (earned.length === 0 && mode === 'compact') return null

  if (mode === 'compact') {
    return (
      <div className="flex flex-wrap gap-1">
        {earned.slice(0, 6).map((a) => (
          <span
            key={a.id}
            title={`${a.name}: ${a.description}`}
            className="text-lg cursor-default"
          >
            {a.icon}
          </span>
        ))}
        {earned.length > 6 && (
          <span className="text-xs text-gray-500 self-center">+{earned.length - 6}</span>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-700 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏅</span>
          <h3 className="font-bold text-white text-sm">
            Logros ({earned.length}/{achievements.length})
          </h3>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Always show earned badges in a row */}
      {earned.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-gray-700/50">
          {earned.map((a) => (
            <span
              key={a.id}
              title={`${a.name}: ${a.description}`}
              className="text-xl cursor-default hover:scale-125 transition-transform"
            >
              {a.icon}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: show full list */}
      {expanded && (
        <div className="divide-y divide-gray-700/50">
          {earned.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-2xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{a.name}</p>
                <p className="text-xs text-gray-400">{a.description}</p>
              </div>
              <span className="text-green-400 text-xs font-semibold">✓</span>
            </div>
          ))}
          {locked.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 opacity-40">
              <span className="text-2xl grayscale">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{a.name}</p>
                <p className="text-xs text-gray-400">{a.description}</p>
              </div>
              <span className="text-gray-600 text-xs">🔒</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

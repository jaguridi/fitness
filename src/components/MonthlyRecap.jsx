import { useEffect, useState } from 'react'
import { getMonthlyRecap } from '../services/firebaseService'

/**
 * Monthly Recap — AI-generated narrative summary of the previous month.
 * Shown on the Stats page when the month transitions (i.e. only the first
 * few days of a new month show last month's recap).
 *
 * Display window: days 1–7 of the current month → show previous month.
 * Outside that window the component is hidden to avoid clutter.
 */
export default function MonthlyRecap() {
  const [recap, setRecap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState(null)

  // Compute previous month ID (YYYY-MM)
  const now = new Date()
  const dayOfMonth = now.getDate()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthId = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

  const showWindow = dayOfMonth <= 7

  useEffect(() => {
    if (!showWindow) return
    const dismissedKey = `monthly_recap_dismissed_${monthId}`
    if (localStorage.getItem(dismissedKey)) {
      setHidden(true)
      return
    }
    setLoading(true)
    getMonthlyRecap(monthId)
      .then((data) => setRecap(data))
      .catch((err) => {
        console.warn('Monthly recap unavailable:', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [monthId, showWindow])

  if (!showWindow || hidden || error) return null

  const dismiss = () => {
    localStorage.setItem(`monthly_recap_dismissed_${monthId}`, '1')
    setHidden(true)
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-2xl border border-purple-700/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📰</span>
          <span className="text-sm font-bold text-purple-300">Recap mensual</span>
        </div>
        <div className="space-y-2">
          <div className="animate-pulse bg-purple-800/30 h-3 w-full rounded" />
          <div className="animate-pulse bg-purple-800/30 h-3 w-5/6 rounded" />
          <div className="animate-pulse bg-purple-800/30 h-3 w-4/6 rounded" />
        </div>
      </div>
    )
  }

  if (!recap?.recap) return null

  const totals = recap.totals || {}

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-2xl border border-purple-700/30 p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700/50"
      >
        ✕
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📰</span>
        <span className="text-sm font-bold text-purple-300 capitalize">
          {recap.monthLabel || recap.monthId}
        </span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
        {recap.recap}
      </p>
      {(totals.sessions || totals.minutes || totals.calories) && (
        <div className="mt-3 pt-3 border-t border-purple-700/20 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-white">{totals.sessions || 0}</p>
            <p className="text-[10px] text-gray-500">sesiones</p>
          </div>
          <div>
            <p className="text-lg font-bold text-cyan-400">
              {Math.floor((totals.minutes || 0) / 60)}h
            </p>
            <p className="text-[10px] text-gray-500">tiempo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-400">
              {totals.calories >= 1000
                ? `${(totals.calories / 1000).toFixed(1)}k`
                : (totals.calories || 0)}
            </p>
            <p className="text-[10px] text-gray-500">kcal</p>
          </div>
        </div>
      )}
    </div>
  )
}

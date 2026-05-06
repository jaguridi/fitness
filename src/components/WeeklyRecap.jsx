import { useState, useEffect } from 'react'
import { getWeeklyRecap } from '../services/firebaseService'
import { getPreviousWeekId } from '../hooks/useWeekId'

/**
 * Weekly Recap — AI-generated humorous summary of the previous week.
 * Shown on the Dashboard below the pot counter.
 */
export default function WeeklyRecap({ currentWeekId }) {
  const [recap, setRecap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const prevWeekId = getPreviousWeekId(currentWeekId)

  useEffect(() => {
    // Check if user already dismissed this recap
    const dismissedKey = `recap_dismissed_${prevWeekId}`
    if (localStorage.getItem(dismissedKey)) {
      setDismissed(true)
      return
    }

    setLoading(true)
    getWeeklyRecap(prevWeekId)
      .then((data) => setRecap(data))
      .catch((err) => {
        console.warn('Weekly recap unavailable:', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [prevWeekId])

  const handleDismiss = () => {
    localStorage.setItem(`recap_dismissed_${prevWeekId}`, '1')
    setDismissed(true)
  }

  if (dismissed || error) return null

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-2xl border border-indigo-700/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📻</span>
          <span className="text-sm font-bold text-indigo-300">Recap semanal</span>
        </div>
        <div className="space-y-2">
          <div className="animate-pulse bg-indigo-800/30 h-3 w-full rounded" />
          <div className="animate-pulse bg-indigo-800/30 h-3 w-4/5 rounded" />
          <div className="animate-pulse bg-indigo-800/30 h-3 w-3/5 rounded" />
        </div>
      </div>
    )
  }

  if (!recap?.recap) return null

  return (
    <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-2xl border border-indigo-700/30 p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700/50"
      >
        ✕
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📻</span>
        <span className="text-sm font-bold text-indigo-300">
          Recap {recap.weekId}
        </span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
        {recap.recap}
      </p>
    </div>
  )
}

import { useState } from 'react'
import { WEEKLY_GOAL } from '../constants'
import { addAbsence } from '../services/firebaseService'
import { getWeekId, getAdjacentWeeks, formatWeekLabel, getWeekRange } from '../hooks/useWeekId'
import { addWeeks, format } from 'date-fns'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'

export default function AbsencePlanner({ onSuccess }) {
  const { currentUser } = useAuth()
  const userId = currentUser?.id || ''
  const [absenceDate, setAbsenceDate] = useState('')
  const [frozenSessions, setFrozenSessions] = useState(WEEKLY_GOAL)
  const [recoveryWeeks, setRecoveryWeeks] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Generate future weeks for selection
  const futureWeeks = []
  const now = new Date()
  for (let i = 1; i <= 8; i++) {
    const d = addWeeks(now, i)
    futureWeeks.push(getWeekId(d))
  }

  const frozenWeekId = absenceDate ? getWeekId(new Date(absenceDate + 'T12:00:00')) : null
  const adjacentWeeks = frozenWeekId ? getAdjacentWeeks(frozenWeekId) : []

  const toggleRecoveryWeek = (weekId) => {
    setRecoveryWeeks((prev) =>
      prev.includes(weekId) ? prev.filter((w) => w !== weekId) : [...prev, weekId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!userId || !frozenWeekId || recoveryWeeks.length === 0) {
      setError('Selecciona la semana de ausencia y al menos una semana de recuperación.')
      return
    }

    setSubmitting(true)
    try {
      // Distribute frozen sessions across recovery weeks (round-robin for evenness)
      const missedPerWeek = {}
      recoveryWeeks.forEach((wk) => { missedPerWeek[wk] = 0 })
      for (let i = 0; i < frozenSessions; i++) {
        const wk = recoveryWeeks[i % recoveryWeeks.length]
        missedPerWeek[wk] += 1
      }

      await addAbsence({
        userId,
        frozenWeekId,
        frozenSessions,
        recoveryWeeks,
        missedSessionsPerRecoveryWeek: missedPerWeek,
        status: 'active',
      })

      setSuccess(true)
      setAbsenceDate('')
      setRecoveryWeeks([])
      setFrozenSessions(WEEKLY_GOAL)
      onSuccess?.()
    } catch (err) {
      console.error(err)
      setError('Error al guardar la ausencia.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">✈️ Planificar Ausencia</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Logged-in user indicator */}
        <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
          <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
          <div>
            <p className="font-semibold text-white">{currentUser?.name}</p>
            <p className="text-xs text-gray-400">Planificando ausencia para {currentUser?.name}</p>
          </div>
        </div>

        {/* Absence date (picks a week) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Fecha dentro de la semana de ausencia
          </label>
          <input
            type="date"
            value={absenceDate}
            onChange={(e) => {
              setAbsenceDate(e.target.value)
              setRecoveryWeeks([])
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {frozenWeekId && (
            <p className="text-sm text-blue-400 mt-1">
              Semana congelada: {formatWeekLabel(frozenWeekId)}
            </p>
          )}
        </div>

        {/* Frozen sessions selector */}
        {frozenWeekId && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              ¿Cuántas sesiones quieres congelar?
            </label>
            <div className="flex gap-2">
              {Array.from({ length: WEEKLY_GOAL }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFrozenSessions(n)}
                  className={`flex-1 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                    frozenSessions === n
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {frozenSessions === WEEKLY_GOAL
                ? 'Congelas la semana completa. No tendrás meta esa semana.'
                : `Congelas ${frozenSessions} sesión(es). Aún debes completar las restantes (${WEEKLY_GOAL - frozenSessions}) esa semana.`}
            </p>
          </div>
        )}

        {/* Recovery weeks */}
        {adjacentWeeks.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Semanas de recuperación (selecciona una o más)
            </label>
            <div className="space-y-2">
              {adjacentWeeks.map((wk) => (
                <button
                  type="button"
                  key={wk}
                  onClick={() => toggleRecoveryWeek(wk)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                    recoveryWeeks.includes(wk)
                      ? 'bg-green-600/20 ring-2 ring-green-400 text-green-300'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {formatWeekLabel(wk)}
                  {recoveryWeeks.includes(wk) && ' ✓'}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
        )}
        {success && (
          <p className="text-green-400 text-sm bg-green-900/20 rounded-xl p-2">
            ✅ Ausencia planificada correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            submitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
          }`}
        >
          {submitting ? '⏳ Guardando...' : '📅 Registrar Ausencia'}
        </button>
      </form>
    </div>
  )
}

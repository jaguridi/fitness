import { useEffect, useState } from 'react'
import { getAppMeta, setAppMeta } from '../services/firebaseService'
import { getPreviousWeekId, formatWeekLabel } from '../hooks/useWeekId'

function buildPastWeeks(currentWeekId, count = 30) {
  const weeks = []
  let cursor = getPreviousWeekId(currentWeekId)
  for (let i = 0; i < count && cursor; i++) {
    weeks.push(cursor)
    const prev = getPreviousWeekId(cursor)
    if (prev === cursor) break
    cursor = prev
  }
  return weeks
}

/**
 * Lets an admin rewind `settings/meta.lastAutoProcessedWeekId` to an earlier
 * week. On the next app load, the auto week-end loop in useGameLogic walks
 * forward from there and re-applies fines for each unprocessed week.
 *
 * Useful when the lock advanced past weeks whose fines were silently lost.
 */
export default function RewindLock({ currentWeekId }) {
  const [currentLock, setCurrentLock] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const pastWeeks = buildPastWeeks(currentWeekId)

  useEffect(() => {
    getAppMeta()
      .then((m) => setCurrentLock(m.lastAutoProcessedWeekId ?? '(no fijado)'))
      .catch((err) => setError(err.message || 'No se pudo leer el lock actual.'))
  }, [])

  const handleRewind = async () => {
    if (!selectedWeek) {
      setError('Elegí una semana primero.')
      return
    }
    const confirmed = confirm(
      `Vas a fijar el lock en ${selectedWeek}.\n\n` +
      `Al recargar la app, se reprocesarán todas las semanas entre ${selectedWeek} y ${getPreviousWeekId(currentWeekId)} en orden, aplicando las multas que correspondan según los workouts/justificaciones de cada semana.\n\n` +
      `¿Continuar?`
    )
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    try {
      await setAppMeta({ lastAutoProcessedWeekId: selectedWeek })
      setDone(true)
      setCurrentLock(selectedWeek)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el lock.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-2">⏪ Reprocesar Semanas Pasadas</h3>
      <p className="text-sm text-gray-400 mb-3">
        Rebobiná el lock de cierre automático para que la app reprocese semanas
        pasadas y reaplique multas perdidas. La app se recargará al confirmar.
      </p>

      <div className="bg-gray-900/50 rounded-xl p-2 mb-3 text-xs">
        <span className="text-gray-400">Lock actual: </span>
        <span className="text-white font-mono">{currentLock ?? 'cargando...'}</span>
      </div>

      <label className="block text-sm font-medium text-gray-300 mb-1">
        Procesar desde la semana siguiente a:
      </label>
      <select
        value={selectedWeek}
        onChange={(e) => setSelectedWeek(e.target.value)}
        disabled={submitting || done}
        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white mb-3"
      >
        <option value="">— Elegí una semana —</option>
        {pastWeeks.map((wk) => (
          <option key={wk} value={wk}>
            {wk} ({formatWeekLabel(wk)})
          </option>
        ))}
      </select>

      {error && (
        <p className="text-red-400 text-xs bg-red-900/20 rounded-xl p-2 mb-2">{error}</p>
      )}

      <button
        onClick={handleRewind}
        disabled={submitting || done || !selectedWeek}
        className={`w-full py-3 rounded-xl font-bold transition-all ${
          submitting || done || !selectedWeek
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-amber-600 hover:bg-amber-500 text-white active:scale-95'
        }`}
      >
        {submitting
          ? '⏳ Actualizando...'
          : done
          ? '✅ Lock actualizado — recargando...'
          : '⏪ Rebobinar y reprocesar'}
      </button>
    </div>
  )
}

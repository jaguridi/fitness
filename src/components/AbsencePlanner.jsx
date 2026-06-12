import { useMemo, useState } from 'react'
import { WEEKLY_GOAL } from '../constants'
import {
  addAbsence,
  updateAbsence,
  deleteAbsence,
} from '../services/firebaseService'
import {
  getWeekId,
  formatWeekLabel,
  getWeeksBetween,
  getRecoveryWindow,
} from '../hooks/useWeekId'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import Card from './ui/Card'
import ConfirmDialog from './ui/ConfirmDialog'

function weekIdFromDate(dateStr) {
  if (!dateStr) return null
  return getWeekId(new Date(dateStr + 'T12:00:00'))
}

function summarizeFrozenWeeks(frozenWeeks) {
  if (!frozenWeeks) return ''
  const ids = Object.keys(frozenWeeks).sort()
  if (ids.length === 0) return ''
  if (ids.length === 1) {
    return `${formatWeekLabel(ids[0])} · ${frozenWeeks[ids[0]]} ses.`
  }
  const total = Object.values(frozenWeeks).reduce((s, n) => s + n, 0)
  return `${formatWeekLabel(ids[0])} → ${formatWeekLabel(ids[ids.length - 1])} · ${total} ses. totales`
}

export default function AbsencePlanner({ absences = [], onChange }) {
  const { currentUser } = useAuth()
  const userId = currentUser?.id || ''

  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [sessionsByWeek, setSessionsByWeek] = useState({}) // { weekId: 1..3 }
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const startWeekId = weekIdFromDate(startDate)
  const endWeekId = weekIdFromDate(endDate)

  // Order start/end so the UI doesn't force the user to pick the right order
  const [orderedStart, orderedEnd] = useMemo(() => {
    if (!startWeekId || !endWeekId) return [startWeekId, endWeekId]
    return startWeekId <= endWeekId
      ? [startWeekId, endWeekId]
      : [endWeekId, startWeekId]
  }, [startWeekId, endWeekId])

  const weeksInRange = useMemo(
    () => (orderedStart && orderedEnd ? getWeeksBetween(orderedStart, orderedEnd) : []),
    [orderedStart, orderedEnd]
  )

  // Default each week to WEEKLY_GOAL (full freeze) if not yet set
  const frozenWeeks = useMemo(() => {
    const map = {}
    for (const wk of weeksInRange) {
      map[wk] = sessionsByWeek[wk] ?? WEEKLY_GOAL
    }
    return map
  }, [weeksInRange, sessionsByWeek])

  const totalFrozen = Object.values(frozenWeeks).reduce((s, n) => s + n, 0)
  const recoveryWindow = useMemo(
    () => (orderedStart && orderedEnd ? getRecoveryWindow(orderedStart, orderedEnd, 3) : []),
    [orderedStart, orderedEnd]
  )
  const recoveryNonFrozen = recoveryWindow.filter((w) => !frozenWeeks[w])

  const resetForm = () => {
    setEditingId(null)
    setStartDate(today)
    setEndDate(today)
    setSessionsByWeek({})
    setError('')
  }

  const startEdit = (a) => {
    if (!a.frozenWeeks) {
      // Legacy absences aren't editable through this form — they use the
      // manual recovery-week model. Users can delete them and recreate.
      return
    }
    const ids = Object.keys(a.frozenWeeks).sort()
    if (ids.length === 0) return
    // Convert weekId to a representative date inside the week (Monday).
    const firstWeek = ids[0]
    const lastWeek = ids[ids.length - 1]
    const [firstYear, firstWeekNum] = firstWeek.split('-W').map(Number)
    const [lastYear, lastWeekNum] = lastWeek.split('-W').map(Number)
    // Use ISO week → date via Jan 1 + offset, mirroring useWeekId.getWeekRange
    const dateFromWeekId = (year, weekNum) => {
      const jan1 = new Date(year, 0, 1)
      const jan1Day = jan1.getDay() || 7
      const firstMonday = new Date(year, 0, 1 + (1 - jan1Day))
      const monday = new Date(firstMonday)
      monday.setDate(firstMonday.getDate() + (weekNum - 1) * 7)
      return monday.toISOString().slice(0, 10)
    }
    setStartDate(dateFromWeekId(firstYear, firstWeekNum))
    setEndDate(dateFromWeekId(lastYear, lastWeekNum))
    setSessionsByWeek({ ...a.frozenWeeks })
    setEditingId(a.id)
    setError('')
    setSuccess('')
  }

  const handleDelete = async () => {
    const id = deleteId
    setDeleteId(null)
    try {
      await deleteAbsence(id)
      if (editingId === id) resetForm()
      setSuccess('🗑️ Congelamiento eliminado.')
      onChange?.()
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!userId || weeksInRange.length === 0) {
      setError('Selecciona un rango de fechas válido.')
      return
    }
    if (totalFrozen === 0) {
      setError('Debes congelar al menos 1 sesión.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        userId,
        frozenWeeks,
        status: 'active',
        updatedAt: new Date().toISOString(),
      }
      if (editingId) {
        await updateAbsence(editingId, payload)
        setSuccess('✅ Congelamiento actualizado.')
      } else {
        await addAbsence(payload)
        setSuccess('✅ Congelamiento registrado.')
      }
      resetForm()
      onChange?.()
    } catch (err) {
      console.error(err)
      setError('Error al guardar el congelamiento.')
    } finally {
      setSubmitting(false)
    }
  }

  // Sort: active first (closest first), then closed by createdAt desc
  const myAbsences = useMemo(() => {
    const list = absences.filter((a) => a.userId === userId)
    return [...list].sort((a, b) => {
      const aActive = a.status !== 'closed'
      const bActive = b.status !== 'closed'
      if (aActive !== bActive) return aActive ? -1 : 1
      const aKey = Object.keys(a.frozenWeeks || { [a.frozenWeekId]: 1 })[0] || ''
      const bKey = Object.keys(b.frozenWeeks || { [b.frozenWeekId]: 1 })[0] || ''
      return bKey.localeCompare(aKey)
    })
  }, [absences, userId])

  return (
    <Card className="p-4">
      <h3 className="text-lg font-bold text-white mb-4">✈️ Congelar Semanas</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Logged-in user indicator */}
        <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
          <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
          <div>
            <p className="font-semibold text-white">{currentUser?.name}</p>
            <p className="text-xs text-gray-400">
              {editingId
                ? 'Editando un congelamiento existente'
                : 'Nuevo congelamiento (puede ser la semana en curso)'}
            </p>
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Per-week sessions selector */}
        {weeksInRange.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sesiones a congelar por semana
            </label>
            <div className="space-y-2">
              {weeksInRange.map((wk) => (
                <div
                  key={wk}
                  className="flex items-center justify-between bg-gray-700/40 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-gray-200">{formatWeekLabel(wk)}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: WEEKLY_GOAL }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setSessionsByWeek((prev) => ({ ...prev, [wk]: n }))
                        }
                        className={`w-9 h-9 rounded-lg font-bold transition-all active:scale-95 ${
                          (frozenWeeks[wk] ?? WEEKLY_GOAL) === n
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Total a congelar: <span className="text-white font-semibold">{totalFrozen}</span> sesión(es).
              {recoveryNonFrozen.length > 0 && (
                <>
                  {' '}Tendrás {recoveryNonFrozen.length} semana(s) de recuperación automática
                  alrededor del rango (±3) para hacer sesiones extra y pagar la deuda.
                </>
              )}
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
        )}
        {success && (
          <p className="text-green-400 text-sm bg-green-900/20 rounded-xl p-2">{success}</p>
        )}

        <div className="flex gap-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${
              submitting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
            }`}
          >
            {submitting
              ? '⏳ Guardando...'
              : editingId
              ? '💾 Guardar cambios'
              : '📅 Registrar congelamiento'}
          </button>
        </div>
      </form>

      {/* List existing absences for the current user */}
      {myAbsences.length > 0 && (
        <div className="mt-6 border-t border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Tus congelamientos</h4>
          <div className="space-y-2">
            {myAbsences.map((a) => {
              const isLegacy = !a.frozenWeeks
              const closed = a.status === 'closed'
              return (
                <div
                  key={a.id}
                  className={`rounded-xl p-3 border ${
                    closed
                      ? 'bg-gray-900/40 border-gray-700/60'
                      : 'bg-blue-900/15 border-blue-700/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {isLegacy
                          ? `Antiguo · ${formatWeekLabel(a.frozenWeekId)} · ${a.frozenSessions || WEEKLY_GOAL} ses.`
                          : summarizeFrozenWeeks(a.frozenWeeks)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {closed
                          ? a.debtUnpaid > 0
                            ? `Cerrado · deuda no pagada: ${a.debtUnpaid} ses. (multa aplicada)`
                            : 'Cerrado · deuda completada'
                          : isLegacy
                          ? 'Recuperación manual (formato antiguo)'
                          : 'Activo · recuperación automática ±3 semanas'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!closed && !isLegacy && (
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 text-xs font-semibold px-2 py-1 rounded-lg"
                        >
                          ✏️ Editar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteId(a.id)}
                        className="bg-red-600/20 text-red-300 hover:bg-red-600/30 text-xs font-semibold px-2 py-1 rounded-lg"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          icon="🗑️"
          title="¿Eliminar congelamiento?"
          message="Si tenías deuda de recuperación, se recalculará en el siguiente cierre semanal."
          confirmLabel="Eliminar"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </Card>
  )
}

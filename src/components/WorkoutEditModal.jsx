import { useState } from 'react'
import { EXERCISE_TYPES, getExerciseTypes } from '../constants'
import { updateWorkout, deleteWorkout } from '../services/firebaseService'
import useEscapeToClose from '../hooks/useEscapeToClose'

/**
 * Edit modal for an owned workout, within the 24h window.
 * Photo, date and weekId are NOT editable — those would invalidate fraud
 * checks and week summaries. Only the lightweight fields can be tweaked.
 */
export default function WorkoutEditModal({ workout, onClose, onSaved, onDeleted }) {
  useEscapeToClose(onClose)
  const [exerciseTypes, setExerciseTypes] = useState(getExerciseTypes(workout))
  const [duration, setDuration] = useState(String(workout.duration || ''))
  const [calories, setCalories] = useState(
    workout.calories ? String(workout.calories) : ''
  )
  const [description, setDescription] = useState(workout.description || '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (exerciseTypes.length === 0 || !duration) {
      setError('Tipo de ejercicio y duración son obligatorios.')
      return
    }
    setSubmitting(true)
    try {
      const caloriesValue = calories.trim() ? parseInt(calories) : null
      await updateWorkout(workout.id, {
        exerciseType: exerciseTypes,
        duration: parseInt(duration),
        description,
        // null is meaningful: clears a previously set calorie value
        calories: caloriesValue && caloriesValue > 0 ? caloriesValue : null,
      })
      onSaved?.()
      onClose?.()
    } catch (err) {
      console.error(err)
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      await deleteWorkout(workout.id)
      onDeleted?.()
      onClose?.()
    } catch (err) {
      console.error(err)
      setError('Error al eliminar. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">✏️ Editar Ejercicio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-amber-900/15 border border-amber-700/30 rounded-xl p-2 text-xs text-amber-300">
            ⓘ Solo puedes editar dentro de las primeras 24h. La foto y fecha no se pueden cambiar.
          </div>

          {/* Exercise type chips */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo de ejercicio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXERCISE_TYPES.map((t) => {
                const selected = exerciseTypes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setExerciseTypes((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                      selected
                        ? 'bg-indigo-600 text-white ring-1 ring-indigo-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {selected && '✓ '}{t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration + Calories */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Duración (min)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                🔥 Calorías{' '}
                <span className="text-xs text-gray-500 font-normal">(opc.)</span>
              </label>
              <input
                type="number"
                min="0"
                max="5000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
          )}

          {/* Actions */}
          {confirmDelete ? (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 space-y-2">
              <p className="text-sm text-red-300 text-center">
                ¿Eliminar este ejercicio? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 rounded-xl font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDelete}
                  className="flex-1 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? '⏳' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-3 rounded-xl font-semibold text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-all"
              >
                🗑️
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold text-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? '⏳ Guardando...' : '💾 Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Returns true if the workout is still within the 24h edit window.
 */
export function canEditWorkout(workout, currentUserId) {
  if (!workout || workout.userId !== currentUserId) return false
  const createdMs = workout.createdAt?.seconds
    ? workout.createdAt.seconds * 1000
    : workout.createdAt instanceof Date
    ? workout.createdAt.getTime()
    : null
  if (!createdMs) return false
  return Date.now() - createdMs < 24 * 60 * 60 * 1000
}

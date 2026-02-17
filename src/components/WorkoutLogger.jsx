import { useState } from 'react'
import { format } from 'date-fns'
import { USERS, EXERCISE_TYPES } from '../constants'
import { addWorkout, uploadWorkoutPhoto } from '../services/firebaseService'
import { getWeekId } from '../hooks/useWeekId'

export default function WorkoutLogger({ onClose, onSuccess }) {
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exerciseType, setExerciseType] = useState('')
  const [duration, setDuration] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!userId || !date || !exerciseType || !duration || !photo) {
      setError('Todos los campos son obligatorios, incluyendo la foto.')
      return
    }

    setSubmitting(true)
    try {
      const photoURL = await uploadWorkoutPhoto(photo, userId, date)
      const weekId = getWeekId(new Date(date + 'T12:00:00'))

      await addWorkout({
        userId,
        date,
        weekId,
        exerciseType,
        duration: parseInt(duration),
        description,
        photoURL,
      })

      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error(err)
      setError('Error al guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">📝 Registrar Ejercicio</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* User selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              ¿Quién eres?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {USERS.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setUserId(u.id)}
                  className={`p-2 rounded-xl text-center transition-all ${
                    userId === u.id
                      ? 'bg-indigo-600 ring-2 ring-indigo-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-2xl">{u.avatar}</div>
                  <div className="text-xs mt-1 text-gray-300 truncate">{u.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Exercise type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo de ejercicio
            </label>
            <select
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Duración (minutos)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              📸 Foto (obligatoria)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-semibold hover:file:bg-indigo-500 file:cursor-pointer"
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                className="mt-2 rounded-xl w-full max-h-48 object-cover"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué hiciste hoy?"
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !photo}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
              submitting || !photo
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
            }`}
          >
            {submitting ? '⏳ Guardando...' : '💪 Registrar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

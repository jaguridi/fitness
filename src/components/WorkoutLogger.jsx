import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { EXERCISE_TYPES } from '../constants'
import { addWorkout, uploadWorkoutPhoto } from '../services/firebaseService'
import { getWeekId } from '../hooks/useWeekId'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import { compressImageWithObjectURL } from '../utils/compressImage'
import { validatePhotoDate } from '../utils/extractPhotoDate'
import { describeUploadError } from '../utils/uploadErrors'

export default function WorkoutLogger({ onClose, onSuccess }) {
  const { currentUser } = useAuth()
  const userId = currentUser?.id || ''

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exerciseTypes, setExerciseTypes] = useState([]) // array now
  const [duration, setDuration] = useState('')
  const [calories, setCalories] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [dateWarning, setDateWarning] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const previewUrlRef = useRef(null)

  // Revoke the object URL when the preview changes or the component unmounts —
  // otherwise the blob stays in memory until the page is closed.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  const replacePreview = (newUrl) => {
    if (previewUrlRef.current && previewUrlRef.current !== newUrl) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = newUrl
    setPhotoPreview(newUrl)
  }

  const processPhoto = async (file) => {
    if (!file) return

    // Guard: empty file usually means the camera failed to save (device storage full)
    if (!file.size) {
      setError('No se pudo leer la foto. Probablemente tu teléfono no tiene espacio libre — libera almacenamiento y vuelve a intentarlo, o usa la Galería con una foto ya guardada.')
      return
    }

    try {
      // Compress image with object-URL preview (cheap RAM-wise vs base64)
      const { file: compressed, previewUrl } = await compressImageWithObjectURL(file)
      setPhoto(compressed)
      replacePreview(previewUrl)

      // Validate EXIF date against reported date (reads only first 128KB, no decode)
      const validation = await validatePhotoDate(file, date)
      if (validation.message) {
        setDateWarning(validation)
      } else {
        setDateWarning(null)
      }

      // If validation failed (photo date doesn't match), show error but don't block
      if (!validation.valid) {
        setError(validation.message)
      }
    } catch (err) {
      console.error('processPhoto error:', err)
      // Fallback: skip compression entirely, show preview from raw blob URL
      try {
        setPhoto(file)
        replacePreview(URL.createObjectURL(file))
        setDateWarning(null)
      } catch {
        setError('No se pudo procesar la foto. Tu navegador puede estar sin memoria — cierra otras pestañas o libera espacio del teléfono y reintenta.')
      }
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) processPhoto(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!userId || !date || exerciseTypes.length === 0 || !duration || !photo) {
      setError('Todos los campos son obligatorios, incluyendo la foto y al menos un tipo de ejercicio.')
      return
    }

    // Block submission if photo date validation failed
    if (dateWarning && !dateWarning.valid) {
      setError(dateWarning.message)
      return
    }

    setSubmitting(true)
    try {
      const photoURL = await uploadWorkoutPhoto(photo, userId, date)
      const weekId = getWeekId(new Date(date + 'T12:00:00'))

      const caloriesValue = calories.trim() ? parseInt(calories) : null
      await addWorkout({
        userId,
        date,
        weekId,
        exerciseType: exerciseTypes, // now an array
        duration: parseInt(duration),
        ...(caloriesValue && caloriesValue > 0 ? { calories: caloriesValue } : {}),
        description,
        photoURL,
      })

      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error(err)
      setError(describeUploadError(err))
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
          {/* Logged-in user indicator */}
          <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
            <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
            <div>
              <p className="font-semibold text-white">{currentUser?.name}</p>
              <p className="text-xs text-gray-400">Registrando como {currentUser?.name}</p>
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
              onChange={(e) => {
                setDate(e.target.value)
                // Re-validate photo date if photo already selected
                if (photo) {
                  validatePhotoDate(photo, e.target.value).then((v) => {
                    setDateWarning(v.message ? v : null)
                    if (!v.valid) setError(v.message)
                    else setError('')
                  }).catch(() => {})
                }
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Exercise type — multi-select chips */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo de ejercicio{' '}
              <span className="text-xs text-gray-500 font-normal">
                (puedes elegir varios)
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXERCISE_TYPES.map((t) => {
                const selected = exerciseTypes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setExerciseTypes((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }}
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
            {exerciseTypes.length > 0 && (
              <p className="mt-1.5 text-xs text-indigo-400">
                {exerciseTypes.length === 1
                  ? `Seleccionado: ${exerciseTypes[0]}`
                  : `${exerciseTypes.length} ejercicios: ${exerciseTypes.join(' + ')}`}
              </p>
            )}
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
                placeholder="30"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                🔥 Calorías{' '}
                <span className="text-xs text-gray-500 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="450"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Photo — camera/gallery/file buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              📸 Foto (obligatoria)
            </label>
            <div className="flex gap-2">
              {/* Camera button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                📷 Cámara
              </button>
              {/* Gallery button */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gray-700 hover:bg-gray-600 text-white transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                🖼️ Galería
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {/* Tip when no photo selected yet */}
            {!photoPreview && (
              <p className="mt-1.5 text-[11px] text-gray-500">
                💡 Si ves "Memoria insuficiente" o la cámara falla, cierra otras pestañas del navegador, o usa Galería con una foto ya tomada.
              </p>
            )}

            {/* Photo preview */}
            {photoPreview && (
              <div className="mt-2 relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="rounded-xl w-full max-h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current)
                      previewUrlRef.current = null
                    }
                    setPhotoPreview(null)
                    setDateWarning(null)
                    setError('')
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Date validation warning */}
            {dateWarning && dateWarning.message && dateWarning.valid && (
              <p className="mt-1 text-xs text-amber-400 bg-amber-900/20 rounded-lg p-2">
                ℹ️ {dateWarning.message}
              </p>
            )}
            {dateWarning && !dateWarning.valid && (
              <p className="mt-1 text-xs text-red-400 bg-red-900/20 rounded-lg p-2">
                {dateWarning.message}
              </p>
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
          {error && !dateWarning && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !photo || (dateWarning && !dateWarning.valid)}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
              submitting || !photo || (dateWarning && !dateWarning.valid)
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

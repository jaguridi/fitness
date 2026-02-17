import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addJustification, uploadJustificationPhoto } from '../services/firebaseService'
import { evaluateExcuse } from '../services/aiJudge'
import Avatar from './Avatar'

/**
 * Modal for submitting a justification when a user misses the weekly goal.
 * Allows text + optional photo evidence. AI evaluates the excuse.
 *
 * @param {string} weekId - The week being justified
 * @param {function} onClose - Close the modal
 * @param {function} onResult - Callback with the verdict {valid, reason}
 */
export default function JustificationModal({ weekId, onClose, onResult }) {
  const { currentUser } = useAuth()
  const [excuse, setExcuse] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [verdict, setVerdict] = useState(null)
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

    if (!excuse.trim()) {
      setError('Escribe tu justificación.')
      return
    }

    if (excuse.trim().length < 15) {
      setError('La justificación debe ser más detallada (mínimo 15 caracteres).')
      return
    }

    setSubmitting(true)
    try {
      // 1. Evaluate with AI (send photo as base64 if available)
      const aiResult = await evaluateExcuse(excuse.trim(), photoPreview)
      setVerdict(aiResult)

      // 2. Upload evidence photo to Storage (if provided)
      let evidencePhotoURL = null
      if (photo) {
        evidencePhotoURL = await uploadJustificationPhoto(photo, currentUser.id, weekId)
      }

      // 3. Save justification to Firestore
      await addJustification({
        userId: currentUser.id,
        weekId,
        excuse: excuse.trim(),
        evidencePhotoURL,
        aiVerdict: aiResult.valid,
        aiReason: aiResult.reason,
      })

      // 4. Notify parent
      onResult?.(aiResult)
    } catch (err) {
      console.error('Justification error:', err)
      setError('Error al enviar la justificación. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">⚖️ Justificación</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* User indicator */}
          <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
            <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
            <div>
              <p className="font-semibold text-white">{currentUser?.name}</p>
              <p className="text-xs text-gray-400">
                No cumpliste la meta esta semana. ¿Tienes una justificación?
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 text-sm text-amber-300">
            <p className="font-semibold mb-1">⚠️ Solo para imprevistos</p>
            <p className="text-amber-400 text-xs">
              Enfermedad súbita, lesión, emergencia. Si era previsible (viaje, vacaciones),
              usa la semana congelada. Adjunta evidencia (certificado médico, foto) para mayor probabilidad de aprobación.
            </p>
          </div>

          {!verdict ? (
            /* Submit form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Excuse text */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  ¿Qué pasó? Sé específico.
                </label>
                <textarea
                  value={excuse}
                  onChange={(e) => setExcuse(e.target.value)}
                  placeholder="Ejemplo: Me dio gripe fuerte desde el martes, con fiebre de 39°. Adjunto certificado médico."
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Evidence photo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  📎 Evidencia (opcional pero recomendada)
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
                    alt="Evidencia"
                    className="mt-2 rounded-xl w-full max-h-48 object-cover"
                  />
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-gray-700 hover:bg-gray-600 transition-all"
                >
                  Acepto la multa
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    submitting
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                  }`}
                >
                  {submitting ? '🤖 Evaluando...' : '⚖️ Enviar al Juez IA'}
                </button>
              </div>
            </form>
          ) : (
            /* Verdict display */
            <div className="space-y-4">
              <div
                className={`rounded-2xl p-4 border-2 text-center ${
                  verdict.valid
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-red-900/20 border-red-500/50'
                }`}
              >
                <div className="text-4xl mb-2">
                  {verdict.valid ? '✅' : '❌'}
                </div>
                <h3 className={`text-lg font-bold ${verdict.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {verdict.valid ? 'Justificación Aceptada' : 'Justificación Rechazada'}
                </h3>
                <p className="text-gray-300 text-sm mt-2">
                  {verdict.reason}
                </p>
                {verdict.valid && (
                  <p className="text-green-400/70 text-xs mt-2">
                    La multa se congela esta semana (no se cobra, pero no cuenta como semana exitosa).
                  </p>
                )}
                {!verdict.valid && (
                  <p className="text-red-400/70 text-xs mt-2">
                    Se aplicará la multa correspondiente.
                  </p>
                )}
              </div>

              {/* What was submitted */}
              <div className="bg-gray-700/50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Tu justificación:</p>
                <p className="text-sm text-gray-300">{excuse}</p>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Evidencia"
                    className="mt-2 rounded-lg w-full max-h-32 object-cover"
                  />
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white transition-all"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addJustification, updateJustification, uploadJustificationPhoto } from '../services/firebaseService'
import { evaluateExcuse } from '../services/aiJudge'
import { WEEKLY_GOAL } from '../constants'
import Avatar from './Avatar'
import { compressImageWithPreview, readFileAsDataURL } from '../utils/compressImage'
import { describeUploadError } from '../utils/uploadErrors'
import Modal, { ModalHeader } from './ui/Modal'

/**
 * Modal for submitting or editing/appealing a justification.
 *
 * Modes:
 * - New: no `existing` prop → create a new justification
 * - Appeal: `existing` prop with a rejected justification → edit and re-submit
 *
 * @param {string} weekId - The week being justified
 * @param {object|null} existing - Existing justification to edit/appeal (null for new)
 * @param {function} onClose - Close the modal
 * @param {function} onResult - Callback with the verdict {valid, reason}
 */
export default function JustificationModal({ weekId, existing = null, onClose, onResult }) {
  const { currentUser } = useAuth()
  const isAppeal = !!existing
  const [excuse, setExcuse] = useState(existing?.excuse || '')
  const [sessionsJustified, setSessionsJustified] = useState(
    existing?.sessionsJustified || 1
  )
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(existing?.evidencePhotoURL || null)
  const [submitting, setSubmitting] = useState(false)
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState('')

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.size) {
      setError('No se pudo leer la foto. Probablemente tu teléfono no tiene espacio libre — libera almacenamiento o usa una foto de la galería.')
      return
    }

    try {
      const { file: compressed, preview } = await compressImageWithPreview(file)
      setPhoto(compressed)
      setPhotoPreview(preview)
    } catch (err) {
      console.error('JustificationModal photo error:', err)
      try {
        setPhoto(file)
        const preview = await readFileAsDataURL(file)
        setPhotoPreview(preview)
      } catch {
        setError('No se pudo procesar la foto. Cierra otras pestañas o libera espacio del teléfono.')
      }
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

      // 2. Upload evidence photo to Storage (if new photo provided)
      let evidencePhotoURL = existing?.evidencePhotoURL || null
      if (photo) {
        evidencePhotoURL = await uploadJustificationPhoto(photo, currentUser.id, weekId)
      }

      // Determine save fields based on whether AI succeeded or failed
      const isAiError = aiResult.aiError === true
      const justificationData = {
        excuse: excuse.trim(),
        sessionsJustified,
        evidencePhotoURL,
        aiVerdict: isAiError ? null : aiResult.valid,
        aiReason: aiResult.reason,
        ...(isAiError
          ? { status: 'pending_vote', votes: {} }
          : { status: 'resolved' }),
      }

      if (isAppeal && existing.id) {
        // 3a. Update existing justification (appeal)
        await updateJustification(existing.id, {
          ...justificationData,
          appealCount: (existing.appealCount || 0) + 1,
        })
      } else {
        // 3b. Save new justification to Firestore
        await addJustification({
          userId: currentUser.id,
          weekId,
          ...justificationData,
          appealCount: 0,
        })
      }

      // 4. Notify parent
      onResult?.(aiResult)
    } catch (err) {
      console.error('Justification error:', err)
      setError(describeUploadError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAppealAgain = () => {
    // Reset verdict so user can edit and re-submit
    setVerdict(null)
  }

  return (
    <Modal onClose={onClose} ariaLabel={isAppeal ? 'Editar y apelar justificación' : 'Justificación'}>
      <ModalHeader
        title={isAppeal ? '✏️ Editar y Apelar' : '⚖️ Justificación'}
        onClose={onClose}
      />

      <div className="p-4 space-y-4">
          {/* User indicator */}
          <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
            <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
            <div>
              <p className="font-semibold text-white">{currentUser?.name}</p>
              <p className="text-xs text-gray-400">
                {isAppeal
                  ? 'Edita tu justificación y envía la apelación al Juez IA.'
                  : 'No cumpliste la meta esta semana. ¿Tienes una justificación?'}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 text-sm text-amber-300">
            <p className="font-semibold mb-1">
              {isAppeal ? '📝 Apelación' : '⚠️ Solo para imprevistos'}
            </p>
            <p className="text-amber-400 text-xs">
              {isAppeal
                ? 'Corrige tu justificación, agrega más detalles o mejor evidencia. La IA volverá a evaluar.'
                : 'Enfermedad súbita, lesión, emergencia. Si era previsible (viaje, vacaciones), usa la semana congelada. Adjunta evidencia (certificado médico, foto) para mayor probabilidad de aprobación.'}
            </p>
          </div>

          {/* Previous verdict (only on appeal) */}
          {isAppeal && existing.aiReason && !verdict && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3">
              <p className="text-xs text-red-400 font-semibold mb-1">Respuesta anterior del Juez IA:</p>
              <p className="text-sm text-red-300">❌ {existing.aiReason}</p>
            </div>
          )}

          {!verdict ? (
            /* Submit form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sessions to justify */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  ¿Cuántas sesiones quieres justificar?
                </label>
                <div className="flex gap-2">
                  {Array.from({ length: WEEKLY_GOAL }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSessionsJustified(n)}
                      className={`flex-1 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                        sessionsJustified === n
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {sessionsJustified === WEEKLY_GOAL
                    ? 'Justificas la semana completa. Si se aprueba, no debes hacer ninguna sesión.'
                    : `Justificas ${sessionsJustified} sesión(es). Aún debes completar las restantes (${WEEKLY_GOAL - sessionsJustified}) para evitar la multa.`}
                </p>
              </div>

              {/* Excuse text */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {isAppeal ? '¿Qué pasó? Edita tu justificación.' : '¿Qué pasó? Sé específico.'}
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
                  {isAppeal ? 'Cancelar' : 'Acepto la multa'}
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
                  {submitting
                    ? '🤖 Evaluando...'
                    : isAppeal
                    ? '⚖️ Enviar Apelación'
                    : '⚖️ Enviar al Juez IA'}
                </button>
              </div>
            </form>
          ) : (
            /* Verdict display */
            <div className="space-y-4">
              <div
                className={`rounded-2xl p-4 border-2 text-center ${
                  verdict.aiError
                    ? 'bg-amber-900/20 border-amber-500/50'
                    : verdict.valid
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-red-900/20 border-red-500/50'
                }`}
              >
                <div className="text-4xl mb-2">
                  {verdict.aiError ? '🗳️' : verdict.valid ? '✅' : '❌'}
                </div>
                <h3 className={`text-lg font-bold ${
                  verdict.aiError
                    ? 'text-amber-400'
                    : verdict.valid ? 'text-green-400' : 'text-red-400'
                }`}>
                  {verdict.aiError
                    ? 'Enviada a Votación Familiar'
                    : verdict.valid ? 'Justificación Aceptada' : 'Justificación Rechazada'}
                </h3>
                <p className="text-gray-300 text-sm mt-2">
                  {verdict.reason}
                </p>
                {verdict.aiError && (
                  <p className="text-amber-400/70 text-xs mt-2">
                    Los demás miembros de la familia votarán si aprueban o rechazan tu justificación.
                  </p>
                )}
                {!verdict.aiError && verdict.valid && (
                  <p className="text-green-400/70 text-xs mt-2">
                    La multa se congela esta semana (no se cobra, pero no cuenta como semana exitosa).
                  </p>
                )}
                {!verdict.aiError && !verdict.valid && (
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

              {/* Action buttons */}
              <div className="flex gap-3">
                {!verdict.valid && !verdict.aiError && (
                  <button
                    onClick={handleAppealAgain}
                    className="flex-1 py-3 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95"
                  >
                    ✏️ Editar y Apelar
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`${!verdict.valid && !verdict.aiError ? 'flex-1' : 'w-full'} py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white transition-all`}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
      </div>
    </Modal>
  )
}

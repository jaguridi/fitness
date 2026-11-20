import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CircleAlert, Image as ImageIcon, Info, LoaderCircle, X } from 'lucide-react'
import { Button, IconButton, cx } from '../../components/ui'
import { compressImageWithObjectURL } from '../../utils/compressImage'
import { validatePhotoDate } from '../../utils/extractPhotoDate'
import { photoDateNote } from './logForm'

const EMPTY_FILE_MSG =
  'No se pudo leer la foto. Probablemente tu teléfono no tiene espacio libre: libera almacenamiento y vuelve a intentarlo, o elige una foto ya guardada en la galería.'
const MEMORY_MSG =
  'No se pudo procesar la foto. Tu navegador puede estar sin memoria: cierra otras pestañas o libera espacio del teléfono y vuelve a intentarlo.'

/**
 * Estado de la foto obligatoria: compresión (compressImage), validación de la
 * fecha EXIF contra la fecha del ejercicio (validatePhotoDate, igual que la v1:
 * aviso si no se puede leer o hay 1 día de diferencia, bloqueo si no coincide)
 * y la vista previa como object URL (se libera al cambiar o desmontar).
 *
 * La fecha se valida siempre contra el archivo ORIGINAL: el comprimido pierde el EXIF.
 */
export function usePhotoField(date) {
  const [state, setState] = useState({ file: null, previewUrl: null, check: null, processing: false, error: null })
  const originalRef = useRef(null)
  const previewRef = useRef(null)
  const tokenRef = useRef(0)
  const dateRef = useRef(date)
  dateRef.current = date

  const setPreview = (url) => {
    if (previewRef.current && previewRef.current !== url) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
  }

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    },
    []
  )

  const select = useCallback(async (file) => {
    if (!file) return
    const token = ++tokenRef.current
    if (!file.size) {
      setState((s) => ({ ...s, error: EMPTY_FILE_MSG }))
      return
    }
    setState((s) => ({ ...s, processing: true, error: null }))
    try {
      const { file: compressed, previewUrl } = await compressImageWithObjectURL(file)
      if (token !== tokenRef.current) return URL.revokeObjectURL(previewUrl)
      const check = await validatePhotoDate(file, dateRef.current).catch(() => null)
      if (token !== tokenRef.current) return URL.revokeObjectURL(previewUrl)
      originalRef.current = file
      setPreview(previewUrl)
      setState({ file: compressed, previewUrl, check, processing: false, error: null })
    } catch (err) {
      console.error('processPhoto error:', err)
      if (token !== tokenRef.current) return
      try {
        // Sin compresión: se sube el original.
        const url = URL.createObjectURL(file)
        const check = await validatePhotoDate(file, dateRef.current).catch(() => null)
        originalRef.current = file
        setPreview(url)
        setState({ file, previewUrl: url, check, processing: false, error: null })
      } catch {
        setState((s) => ({ ...s, processing: false, error: MEMORY_MSG }))
      }
    }
  }, [])

  const remove = useCallback(() => {
    tokenRef.current++
    originalRef.current = null
    setPreview(null)
    setState({ file: null, previewUrl: null, check: null, processing: false, error: null })
  }, [])

  // Revalida la foto al cambiar la fecha del ejercicio.
  useEffect(() => {
    const original = originalRef.current
    if (!original) return
    let cancelled = false
    validatePhotoDate(original, date)
      .then((check) => {
        if (!cancelled) setState((s) => (s.file ? { ...s, check } : s))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [date])

  const blocked = Boolean(state.check && !state.check.valid)
  return { ...state, blocked, select, remove }
}

/** Botones Cámara / Galería, vista previa con quitar, y las notas de fecha y errores. */
export default function PhotoField({ photo, date, today, showMissing, disabled }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const note = photoDateNote(photo.check, date, today)
  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (file) photo.select(file)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-small mb-1.5 font-semibold text-ink">Foto</legend>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" tabIndex={-1} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onPick} className="hidden" tabIndex={-1} />

      {photo.previewUrl ? (
        <div className="relative overflow-hidden rounded-control bg-surface-sunk">
          <img src={photo.previewUrl} alt="Vista previa de la foto del ejercicio" className="block max-h-64 w-full object-cover" />
          <IconButton
            icon={X}
            label="Quitar foto"
            variant="surface"
            onClick={photo.remove}
            disabled={disabled}
            className="absolute top-2 right-2 shadow-lift"
          />
        </div>
      ) : (
        <div
          className={cx(
            'flex flex-col items-start gap-3 rounded-control border-[1.5px] border-dashed p-4',
            showMissing ? 'border-danger' : 'border-line-strong'
          )}
        >
          {photo.processing ? (
            <p className="type-small flex items-center gap-2 font-semibold text-ink-soft" role="status">
              <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
              Preparando la foto…
            </p>
          ) : (
            <p className="type-small text-ink-soft">
              Obligatoria: una foto del entrenamiento, tomada el mismo día.
            </p>
          )}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" icon={Camera} onClick={() => cameraRef.current?.click()} disabled={photo.processing || disabled}>
              Cámara
            </Button>
            <Button variant="secondary" icon={ImageIcon} onClick={() => galleryRef.current?.click()} disabled={photo.processing || disabled}>
              Galería
            </Button>
          </div>
        </div>
      )}

      {photo.previewUrl && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={Camera} onClick={() => cameraRef.current?.click()} disabled={photo.processing || disabled}>
            Tomar otra
          </Button>
          <Button variant="ghost" size="sm" icon={ImageIcon} onClick={() => galleryRef.current?.click()} disabled={photo.processing || disabled}>
            Elegir otra
          </Button>
        </div>
      )}

      {note && (
        <p
          role={note.tone === 'block' ? 'alert' : undefined}
          className={cx(
            'type-small flex items-start gap-2 rounded-control px-3 py-2.5',
            note.tone === 'block' ? 'bg-danger/10 text-danger' : 'bg-surface-sunk text-ink-soft'
          )}
        >
          {note.tone === 'block' ? (
            <CircleAlert size={17} strokeWidth={2.3} className="mt-px shrink-0" aria-hidden="true" />
          ) : (
            <Info size={17} strokeWidth={2.3} className="mt-px shrink-0" aria-hidden="true" />
          )}
          <span>{note.text}</span>
        </p>
      )}
      {photo.error && (
        <p role="alert" className="type-small flex items-start gap-2 rounded-control bg-danger/10 px-3 py-2.5 text-danger">
          <CircleAlert size={17} strokeWidth={2.3} className="mt-px shrink-0" aria-hidden="true" />
          <span>{photo.error}</span>
        </p>
      )}
      {!photo.previewUrl && !photo.error && (
        <p className="type-caption text-ink-faint">
          Si la cámara falla o ves “memoria insuficiente”, cierra otras pestañas o elige una foto ya tomada desde la galería.
        </p>
      )}
    </fieldset>
  )
}

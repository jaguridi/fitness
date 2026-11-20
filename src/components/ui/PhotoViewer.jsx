import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useModal from './useModal'

/**
 * PhotoViewer — foto a pantalla completa sobre fondo oscuro. Escape o tocar fuera cierra.
 *
 *   <PhotoViewer src={workout.photoURL} alt="Foto de Jose corriendo" open={viewing}
 *                onClose={() => setViewing(false)} caption="Jose, 45 min de trote" />
 *
 * @param {boolean} open
 * @param {()=>void} onClose
 * @param {string} src
 * @param {string} alt
 * @param {React.ReactNode} [caption]
 */
export default function PhotoViewer({ open, onClose, src, alt = '', caption }) {
  const ref = useModal(open, onClose)
  if (!open || !src) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Foto'}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-[#05080f]/95 outline-none"
      onClick={onClose}
    >
      <div className="flex shrink-0 justify-end px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar foto"
          className="inline-flex size-11 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
        >
          <X size={24} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-[6px] object-contain"
        />
      </div>
      {caption && (
        <p className="type-small shrink-0 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-white/80">
          {caption}
        </p>
      )}
      {!caption && <div className="h-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0" />}
    </div>,
    document.body
  )
}

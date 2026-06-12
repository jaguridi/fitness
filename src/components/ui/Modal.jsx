import useEscapeToClose from '../../hooks/useEscapeToClose'

/**
 * Shared modal shell: dimmed backdrop + panel, Escape to close.
 *
 * variant 'sheet'  — bottom sheet on mobile, centered card on ≥sm (forms)
 * variant 'center' — always centered with outer padding (dialogs)
 *
 * Backdrop clicks only close when `closeOnBackdrop` — forms keep it off so a
 * stray tap doesn't discard input.
 */
export default function Modal({
  onClose,
  variant = 'sheet',
  maxWidth = 'max-w-lg',
  closeOnBackdrop = false,
  dim = 'bg-black/70',
  rounded,
  panelClassName = '',
  ariaLabel,
  children,
}) {
  useEscapeToClose(onClose)
  const sheet = variant === 'sheet'
  const shape = rounded ?? (sheet ? 'rounded-t-3xl sm:rounded-2xl' : 'rounded-2xl')
  return (
    <div
      className={`fixed inset-0 ${dim} backdrop-blur-sm z-50 flex ${
        sheet ? 'items-end sm:items-center' : 'items-center p-4'
      } justify-center`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`bg-gray-800 w-full ${maxWidth} ${shape} max-h-[90vh] overflow-y-auto ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/** Standard modal title bar with a close button. */
export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-700">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="text-gray-400 hover:text-white text-2xl leading-none"
      >
        ✕
      </button>
    </div>
  )
}

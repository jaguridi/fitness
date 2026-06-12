import Modal from './Modal'

/**
 * In-app replacement for window.confirm(): dark themed, backdrop/Escape to
 * cancel. `danger` paints the confirm button red for destructive actions.
 * Extra content (e.g. a preview of the affected item) goes in `children`.
 */
export default function ConfirmDialog({
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <Modal
      onClose={onCancel}
      variant="center"
      maxWidth="max-w-sm"
      closeOnBackdrop
      panelClassName="border border-gray-700 p-6 space-y-4"
      ariaLabel={typeof title === 'string' ? title : undefined}
    >
      <div className="text-center">
        {icon && <div className="text-4xl mb-2">{icon}</div>}
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      {children}
      {message && (
        <p className="text-sm text-gray-300 text-center whitespace-pre-line">{message}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-gray-700 hover:bg-gray-600 transition-all"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-50 ${
            danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

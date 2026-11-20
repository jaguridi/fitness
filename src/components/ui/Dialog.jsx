import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'
import useModal from './useModal'
import { cx } from './cx'

/**
 * Dialog — diálogo centrado y breve (siempre centrado, también en el teléfono).
 * ConfirmDialog — confirmar una acción con dos botones.
 *
 *   <Dialog open={open} onClose={close} title="Semana de descanso"
 *     actions={<Button onClick={close}>Entendido</Button>}>
 *     No suma ni rompe tu racha.
 *   </Dialog>
 *
 *   <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)}
 *     title="¿Eliminar este ejercicio?" description="Se quita del feed y de tu semana."
 *     confirmLabel="Eliminar ejercicio" tone="danger" onConfirm={() => remove(toDelete)} />
 *
 * Dialog: open, onClose, title, children, actions.
 * ConfirmDialog: open, onClose, title, description, confirmLabel, cancelLabel='Cancelar',
 *   tone 'default'|'danger', onConfirm (puede ser async: muestra cargando y cierra al terminar).
 */
export function Dialog({ open, onClose, title, children, actions, className }) {
  const panelRef = useModal(open, onClose)
  const titleId = useId()
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-sm animate-dialog-in rounded-surface bg-surface p-6 text-ink shadow-lift outline-none',
          className
        )}
      >
        <h2 id={titleId} className="type-sub text-ink">
          {title}
        </h2>
        {children && <div className="type-body mt-2 text-ink-soft">{children}</div>}
        {actions && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
}) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    try {
      setBusy(true)
      await onConfirm?.()
      onClose?.()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description}
    </Dialog>
  )
}

export default Dialog

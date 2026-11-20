import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import IconButton from './IconButton'
import useModal from './useModal'
import { cx } from './cx'

/**
 * Sheet — hoja inferior en el teléfono, panel centrado desde 640 px. Reemplaza al Modal v1.
 * Escape cierra, el foco queda dentro y vuelve al botón que la abrió.
 *
 *   <Sheet open={open} onClose={close} title="Registrar ejercicio"
 *          description="Cuéntale a la familia qué hiciste."
 *          footer={<Button block onClick={save}>Registrar ejercicio</Button>}>
 *     …formulario…
 *   </Sheet>
 *
 * @param {boolean} open
 * @param {()=>void} onClose
 * @param {React.ReactNode} title        titular (h2) — siempre ponlo, también da nombre accesible
 * @param {React.ReactNode} [description]
 * @param {React.ReactNode} [footer]     acciones fijas abajo (respeta el área segura)
 * @param {boolean} [dismissible=true]   cerrar tocando fuera / con la X
 * @param {'md'|'lg'} [size='md']        ancho máximo en pantallas grandes (28rem / 36rem)
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  dismissible = true,
  size = 'md',
  className,
  children,
}) {
  const panelRef = useModal(open, dismissible ? onClose : () => {})
  const titleId = useId()
  const descId = useId()
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-scrim"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col bg-surface text-ink shadow-lift outline-none',
          'animate-sheet-up rounded-t-sheet sm:animate-dialog-in sm:rounded-sheet',
          size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md',
          className
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
          <div className="min-w-0 pt-1.5">
            <h2 id={titleId} className="type-heading text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="type-small mt-1 text-ink-soft">
                {description}
              </p>
            )}
          </div>
          {dismissible && <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2" />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
        {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body
  )
}

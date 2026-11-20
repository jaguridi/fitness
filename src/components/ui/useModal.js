import { useEffect, useRef } from 'react'
import useEscapeToClose from '../../hooks/useEscapeToClose'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let locks = 0

/**
 * Comportamiento común de capas modales: Escape, foco atrapado, foco devuelto al
 * cerrar y scroll del fondo bloqueado. Lo usan Sheet, Dialog y PhotoViewer.
 *
 *   const panelRef = useModal(open, onClose)
 *   <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>…</div>
 *
 * El primer elemento con `data-autofocus` recibe el foco; si no hay, el panel.
 */
export default function useModal(open, onClose) {
  const ref = useRef(null)
  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const panel = ref.current
    const first = panel?.querySelector('[data-autofocus]')
    ;(first || panel)?.focus({ preventScroll: true })

    locks += 1
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    panel?.addEventListener('keydown', onKey)

    return () => {
      panel?.removeEventListener('keydown', onKey)
      locks -= 1
      if (locks <= 0) {
        locks = 0
        document.body.style.overflow = prevOverflow === 'hidden' ? '' : prevOverflow
      }
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true })
    }
  }, [open])

  return ref
}

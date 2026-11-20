import { useEffect, useRef } from 'react'

// Pila de capas abiertas: Escape solo cierra la de más arriba.
const stack = []

/**
 * Cierra una capa (hoja, diálogo, visor) con Escape. Si hay varias abiertas,
 * solo cierra la de más arriba. Pasa `active = false` para desactivarlo.
 *
 *   useEscapeToClose(onClose)
 *   useEscapeToClose(onClose, open)
 */
export default function useEscapeToClose(onClose, active = true) {
  const cb = useRef(onClose)
  cb.current = onClose

  useEffect(() => {
    if (!active) return
    const token = {}
    stack.push(token)
    const handler = (e) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== token) return
      e.stopPropagation()
      cb.current?.()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      const i = stack.indexOf(token)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}

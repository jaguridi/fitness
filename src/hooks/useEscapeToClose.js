import { useEffect } from 'react'

/**
 * Close a modal with the Escape key. Pass the modal's onClose handler;
 * listener is attached while the modal is mounted.
 */
export default function useEscapeToClose(onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}

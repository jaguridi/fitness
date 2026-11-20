import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/**
 * Aviso discreto cuando no hay conexión. Firestore guarda los cambios y los sube al
 * volver la conexión; esto solo lo hace visible.
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none"
    >
      <p className="pointer-events-auto inline-flex animate-fade-in items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-on-ink shadow-lift">
        <CloudOff size={16} strokeWidth={2.3} aria-hidden="true" />
        Sin conexión. Tus cambios se guardan y se suben al volver.
      </p>
    </div>
  )
}

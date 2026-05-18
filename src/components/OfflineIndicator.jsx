import { useEffect, useState } from 'react'

/**
 * Tiny status pill that appears when the browser is offline.
 * Firestore queues writes locally and replays them on reconnect — this just
 * surfaces the state to the user so they know their actions are being held.
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-900/90 backdrop-blur-sm border border-amber-700 text-amber-100 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Sin conexión · cambios se sincronizarán
    </div>
  )
}

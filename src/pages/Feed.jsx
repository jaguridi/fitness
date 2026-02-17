import { useState, useEffect } from 'react'
import { USERS } from '../constants'
import { subscribeAllWorkouts, subscribeJustifications } from '../services/firebaseService'
import Avatar from '../components/Avatar'

export default function Feed() {
  const [workouts, setWorkouts] = useState([])
  const [justifications, setJustifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null)

  useEffect(() => {
    let loadCount = 0
    const checkLoaded = () => { loadCount++; if (loadCount >= 2) setLoading(false) }

    const unsub1 = subscribeAllWorkouts(
      (data) => { setWorkouts(data); checkLoaded() },
      (err) => { console.error(err); checkLoaded() }
    )
    const unsub2 = subscribeJustifications(
      (data) => { setJustifications(data); checkLoaded() },
      (err) => { console.error(err); checkLoaded() }
    )
    return () => { unsub1(); unsub2() }
  }, [])

  const getUserInfo = (userId) => USERS.find((u) => u.id === userId) || { name: 'Desconocido', avatar: '❓' }

  const formatTimeAgo = (createdAt) => {
    if (!createdAt?.seconds) return ''
    const diff = Date.now() - createdAt.seconds * 1000
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days}d`
    return `hace ${Math.floor(days / 7)} sem`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-bounce">📸</div>
          <p className="text-gray-400">Cargando feed...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">📸 Feed</h2>
        <p className="text-sm text-gray-400 mt-1">Actividad de toda la familia</p>
      </div>

      {workouts.length === 0 && justifications.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
          <div className="text-4xl mb-2">🏃</div>
          <p className="text-gray-400">Aún no hay actividad. ¡Sé el primero!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Justification cards */}
          {justifications.map((j) => {
            const user = getUserInfo(j.userId)
            return (
              <div
                key={`j-${j.id}`}
                className={`rounded-2xl overflow-hidden border ${
                  j.aiVerdict
                    ? 'bg-amber-900/10 border-amber-700/30'
                    : 'bg-red-900/10 border-red-700/30'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs">{formatTimeAgo(j.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    j.aiVerdict
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'bg-red-600/20 text-red-400'
                  }`}>
                    {j.aiVerdict ? '⚖️ Aceptada' : '❌ Rechazada'}
                  </span>
                </div>

                {/* Evidence photo */}
                {j.evidencePhotoURL && (
                  <button
                    onClick={() => setFullscreenPhoto(j.evidencePhotoURL)}
                    className="w-full"
                  >
                    <img
                      src={j.evidencePhotoURL}
                      alt="Evidencia"
                      className="w-full max-h-64 object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                )}

                <div className="p-3">
                  <p className="text-gray-300 text-sm">
                    <span className="font-semibold text-white">{user.name}:</span>{' '}
                    &ldquo;{j.excuse}&rdquo;
                  </p>
                  <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-block ${
                    j.aiVerdict ? 'bg-amber-900/30 text-amber-300' : 'bg-red-900/30 text-red-300'
                  }`}>
                    🤖 {j.aiReason}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Workout cards */}
          {workouts.map((w) => {
            const user = getUserInfo(w.userId)
            return (
              <div
                key={w.id}
                className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700"
              >
                {/* Post header */}
                <div className="flex items-center gap-3 p-3">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs">{formatTimeAgo(w.createdAt)}</p>
                  </div>
                  <span className="bg-indigo-600/20 text-indigo-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {w.exerciseType}
                  </span>
                </div>

                {/* Photo */}
                {w.photoURL && (
                  <button
                    onClick={() => setFullscreenPhoto(w.photoURL)}
                    className="w-full"
                  >
                    <img
                      src={w.photoURL}
                      alt={w.exerciseType}
                      className="w-full max-h-96 object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                )}

                {/* Stats + description */}
                <div className="p-3">
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-1">
                    <span>⏱️ {w.duration} min</span>
                    <span>📅 {w.date}</span>
                  </div>
                  {w.description && (
                    <p className="text-gray-300 text-sm">
                      <span className="font-semibold text-white">{user.name}</span>{' '}
                      {w.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fullscreen photo modal */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl z-10"
            onClick={() => setFullscreenPhoto(null)}
          >
            ✕
          </button>
          <img
            src={fullscreenPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  )
}

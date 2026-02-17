import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { USERS, formatCLP } from '../constants'
import { getWorkoutsByUser } from '../services/firebaseService'

export default function UserDetail({ gameState }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null)

  const userConst = USERS.find((u) => u.id === userId)
  const userFirestore = gameState.users.find((u) => u.id === userId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getWorkoutsByUser(userId)
      .then((data) => {
        if (!cancelled) {
          setWorkouts(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  if (!userConst) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Usuario no encontrado</p>
        <button onClick={() => navigate('/')} className="text-indigo-400 mt-2">
          Volver al inicio
        </button>
      </div>
    )
  }

  const user = { ...userConst, ...userFirestore }

  return (
    <div className="space-y-4 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
      >
        ← Volver
      </button>

      {/* User header */}
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-center">
        <div className="text-5xl mb-2">{user.avatar}</div>
        <h2 className="text-2xl font-black text-white">{user.name}</h2>
        <div className="flex justify-center gap-4 mt-2 text-sm">
          <span>
            {'❤️'.repeat(user.extraLives || 0)}
            {'🤍'.repeat(Math.max(0, 3 - (user.extraLives || 0)))}
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          Multa acumulada:{' '}
          <span className="text-red-400 font-bold">
            {formatCLP(user.walletBalance || 0)}
          </span>
        </div>
      </div>

      {/* Workouts count */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">
          📸 Entrenamientos ({workouts.length})
        </h3>
      </div>

      {/* Workouts list */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2 animate-bounce">💪</div>
          <p className="text-gray-400">Cargando entrenamientos...</p>
        </div>
      ) : workouts.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
          <p className="text-gray-400">Aún no hay entrenamientos registrados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700"
            >
              {/* Photo */}
              {w.photoURL && (
                <button
                  onClick={() => setFullscreenPhoto(w.photoURL)}
                  className="w-full"
                >
                  <img
                    src={w.photoURL}
                    alt={w.exerciseType}
                    className="w-full h-64 object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="bg-indigo-600/20 text-indigo-400 text-sm font-semibold px-2 py-0.5 rounded-full">
                    {w.exerciseType}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {w.duration} min
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-1">📅 {w.date}</p>
                {w.description && (
                  <p className="text-gray-300 text-sm mt-2">{w.description}</p>
                )}
              </div>
            </div>
          ))}
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

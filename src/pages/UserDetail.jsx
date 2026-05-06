import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { USERS, formatCLP, getExerciseTypes, formatExerciseTypes } from '../constants'
import { getWorkoutsByUser } from '../services/firebaseService'
import Avatar from '../components/Avatar'
import AchievementBadges from '../components/AchievementBadges'
import PersonalBests from '../components/PersonalBests'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { UserDetailSkeleton } from '../components/Skeleton'

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
        <div className="mb-2 flex justify-center"><Avatar src={user.avatar} name={user.name} size="xl" hasShield={user.hasShield} /></div>
        <h2 className="text-2xl font-black text-white">{user.name}</h2>
        <div className="flex justify-center gap-4 mt-2 text-sm">
          <span>
            {'❤️'.repeat(user.extraLives || 0)}
            {'🤍'.repeat(Math.max(0, 3 - (user.extraLives || 0)))}
          </span>
        </div>
        {(user.consecutiveSuccesses || 0) > 0 && (
          <div className={`mt-1 text-sm font-semibold ${user.hasShield ? 'text-cyan-400' : 'text-orange-400'}`}>
            🔥 Racha: {user.consecutiveSuccesses} semanas
            {user.hasShield && ' — 🛡️ Escudo activo (próxima multa -50%)'}
            {!user.hasShield && (user.consecutiveSuccesses || 0) < 4 && ` (${4 - user.consecutiveSuccesses} más para escudo)`}
          </div>
        )}
        <div className="mt-2 text-sm text-gray-400">
          Multa acumulada:{' '}
          <span className="text-red-400 font-bold">
            {formatCLP(user.walletBalance || 0)}
          </span>
        </div>
      </div>

      {/* Achievements */}
      <AchievementBadges userId={userId} user={userFirestore} mode="full" />

      {/* Personal Bests */}
      <PersonalBests userId={userId} />

      {/* Activity Heatmap */}
      <ActivityHeatmap userId={userId} />

      {/* Workouts count */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">
          📸 Entrenamientos ({workouts.length})
        </h3>
      </div>

      {/* Workouts list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
              <div className="animate-pulse bg-gray-700 w-full h-48 rounded-none" />
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <div className="animate-pulse bg-gray-700 h-5 w-16 rounded-full" />
                  <div className="animate-pulse bg-gray-700 h-4 w-14 rounded" />
                </div>
                <div className="animate-pulse bg-gray-700 h-3 w-24 rounded" />
              </div>
            </div>
          ))}
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
                    alt={formatExerciseTypes(w)}
                    loading="lazy"
                    className="w-full h-64 object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex flex-wrap gap-1">
                    {getExerciseTypes(w).map((t) => (
                      <span
                        key={t}
                        className="bg-indigo-600/20 text-indigo-400 text-sm font-semibold px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="text-gray-400 text-sm shrink-0">
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

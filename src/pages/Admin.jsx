import AbsencePlanner from '../components/AbsencePlanner'
import WeeklyHistory from '../components/WeeklyHistory'
import WeekEndProcessor from '../components/WeekEndProcessor'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

export default function Admin({ gameState }) {
  const { processWeekEnd, currentWeekId } = gameState
  const { currentUser, logout } = useAuth()

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-2xl font-black text-white text-center">⚙️ Administración</h2>

      {/* Current user info */}
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={currentUser?.avatar} name={currentUser?.name} size="md" />
          <div>
            <p className="font-semibold text-white">{currentUser?.name}</p>
            <p className="text-xs text-gray-400">Sesión activa</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <WeekEndProcessor
        onProcess={processWeekEnd}
        currentWeekId={currentWeekId}
      />

      <AbsencePlanner />

      <WeeklyHistory />
    </div>
  )
}

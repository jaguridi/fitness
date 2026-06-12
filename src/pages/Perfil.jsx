import { useNavigate } from 'react-router-dom'
import { Dumbbell, BookOpen, Wrench, LogOut, ChevronRight } from 'lucide-react'
import { USERS, getAvatarForMood, formatCLP } from '../constants'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Card from '../components/ui/Card'

const MENU_ITEMS = [
  {
    icon: Dumbbell,
    label: 'Mi actividad',
    desc: 'Historial, fotos, logros y calendario',
    to: (userId) => `/user/${userId}`,
  },
  {
    icon: BookOpen,
    label: 'Reglas y novedades',
    desc: 'Cómo funciona el juego + changelog',
    to: () => '/rules',
  },
  {
    icon: Wrench,
    label: 'Administración',
    desc: 'Cierre de semana, ausencias e historial',
    to: () => '/admin',
  },
]

export default function Perfil({ gameState }) {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()
  const { users } = gameState

  if (!currentUser) return null

  const userConst = USERS.find((u) => u.id === currentUser.id)
  const firestoreUser = users.find((u) => u.id === currentUser.id) || {}
  const lives = firestoreUser.extraLives || 0
  const streak = firestoreUser.consecutiveSuccesses || 0
  const fines = firestoreUser.walletBalance || 0

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-2xl font-black text-white text-center">Perfil</h2>

      {/* User header */}
      <Card className="p-4 flex items-center gap-4">
        <Avatar
          src={getAvatarForMood(userConst, firestoreUser)}
          name={currentUser.name}
          size="lg"
          hasShield={firestoreUser.hasShield}
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xl text-white">{currentUser.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-400">
            <span title="Vidas extra">❤️ {lives}</span>
            <span title="Semanas seguidas cumpliendo">🔥 {streak}</span>
            <span title="Multa acumulada" className={fines > 0 ? 'text-red-400' : ''}>
              💸 {formatCLP(fines)}
            </span>
          </div>
        </div>
      </Card>

      {/* Menu */}
      <Card className="overflow-hidden divide-y divide-gray-700/50">
        {MENU_ITEMS.map(({ icon: Icon, label, desc, to }) => (
          <button
            key={label}
            onClick={() => navigate(to(currentUser.id))}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-700/50 transition-colors active:bg-gray-700"
          >
            <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-white text-sm">{label}</span>
              <span className="block text-xs text-gray-500">{desc}</span>
            </span>
            <ChevronRight size={16} className="text-gray-600 shrink-0" aria-hidden="true" />
          </button>
        ))}
      </Card>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm bg-red-600/15 text-red-400 hover:bg-red-600/25 border border-red-700/30 transition-colors active:scale-[0.98]"
      >
        <LogOut size={16} aria-hidden="true" />
        Cerrar sesión
      </button>
    </div>
  )
}

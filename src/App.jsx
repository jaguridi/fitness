import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Home, Camera, ChartColumn, CircleUser } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import useGameLogic from './hooks/useGameLogic'
import { registerPushToken } from './services/notificationService'
import OnboardingModal, { shouldShowOnboarding } from './components/OnboardingModal'
import OfflineIndicator from './components/OfflineIndicator'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
import UserDetail from './pages/UserDetail'
import Admin from './pages/Admin'
import Rules from './pages/Rules'
import Stats from './pages/Stats'
import Perfil from './pages/Perfil'

// Rules and Admin live inside Perfil, so the Perfil tab stays lit there too.
const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: Home, match: ['/'] },
  { to: '/feed', label: 'Feed', icon: Camera, match: ['/feed'] },
  { to: '/stats', label: 'Stats', icon: ChartColumn, match: ['/stats'] },
  { to: '/perfil', label: 'Perfil', icon: CircleUser, match: ['/perfil', '/rules', '/admin'] },
]

function AppContent() {
  const { isLoggedIn, loading: authLoading, currentUser } = useAuth()
  const gameState = useGameLogic()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { pathname } = useLocation()

  // Show onboarding once per device after first login
  useEffect(() => {
    if (isLoggedIn && currentUser && shouldShowOnboarding()) {
      setShowOnboarding(true)
    }
  }, [isLoggedIn, currentUser?.id])

  // If onboarding was skipped/done, still register push token silently
  useEffect(() => {
    if (!isLoggedIn || !currentUser || showOnboarding) return
    const t = setTimeout(() => registerPushToken(currentUser.id), 3000)
    return () => clearTimeout(t)
  }, [isLoggedIn, currentUser?.id, showOnboarding])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-4xl animate-bounce">💪</div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <OfflineIndicator />
      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
        <Routes>
          <Route path="/" element={<Dashboard gameState={gameState} />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/user/:userId" element={<UserDetail gameState={gameState} />} />
          <Route path="/admin" element={<Admin gameState={gameState} />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/stats" element={<Stats gameState={gameState} />} />
          <Route path="/perfil" element={<Perfil gameState={gameState} />} />
        </Routes>
      </main>

      {/* Onboarding modal — shown once per device */}
      {showOnboarding && currentUser && (
        <OnboardingModal
          userId={currentUser.id}
          onDone={() => setShowOnboarding(false)}
        />
      )}

      {/* Bottom navigation — safe-area padding keeps it above the iOS gesture bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => {
            const active = match.some((p) =>
              p === '/' ? pathname === '/' : pathname.startsWith(p)
            )
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                  active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} className="mx-auto" aria-hidden="true" />
                <div className="mt-0.5">{label}</div>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster theme="dark" position="top-center" richColors />
      <AppContent />
    </AuthProvider>
  )
}

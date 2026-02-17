import { Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import useGameLogic from './hooks/useGameLogic'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
import UserDetail from './pages/UserDetail'
import Admin from './pages/Admin'

function AppContent() {
  const { isLoggedIn, loading: authLoading } = useAuth()
  const gameState = useGameLogic()

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
      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        <Routes>
          <Route path="/" element={<Dashboard gameState={gameState} />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/user/:userId" element={<UserDetail gameState={gameState} />} />
          <Route path="/admin" element={<Admin gameState={gameState} />} />
        </Routes>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 z-30">
        <div className="max-w-lg mx-auto flex">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm font-medium transition-colors ${
                isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <div className="text-xl">🏠</div>
            <div>Inicio</div>
          </NavLink>
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm font-medium transition-colors ${
                isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <div className="text-xl">📸</div>
            <div>Feed</div>
          </NavLink>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm font-medium transition-colors ${
                isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <div className="text-xl">⚙️</div>
            <div>Admin</div>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

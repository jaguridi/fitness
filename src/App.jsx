import { Routes, Route, NavLink } from 'react-router-dom'
import useGameLogic from './hooks/useGameLogic'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App() {
  const gameState = useGameLogic()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        <Routes>
          <Route path="/" element={<Dashboard gameState={gameState} />} />
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

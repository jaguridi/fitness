import { formatCLP } from '../constants'
import Avatar from './Avatar'

export default function WallOfShame({ users }) {
  const usersWithFines = users
    .filter((u) => (u.walletBalance || 0) > 0)
    .sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0))

  if (usersWithFines.length === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-center">
        <p className="text-green-400 font-semibold">
          🎉 ¡Sin multas pendientes! ¡Sigan así!
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
        🔥 Muro de la Vergüenza
      </h3>
      <div className="space-y-2">
        {usersWithFines.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between bg-gray-900/50 rounded-xl px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Avatar src={user.avatar} name={user.name} size="sm" hasShield={user.hasShield} />
              <span className="font-medium text-white">{user.name}</span>
            </div>
            <span className="text-red-400 font-bold font-mono">
              {formatCLP(user.walletBalance || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

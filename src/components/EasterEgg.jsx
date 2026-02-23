import { useMemo } from 'react'
import { USERS } from '../constants'

// ─── Secret title assignment ──────────────────────────────────────────────────
const FALLBACK_TITLES = [
  '🥷 El Ninja Silencioso',
  '🌟 La Estrella Secreta',
  '🦸 El Héroe Anónimo',
  '🎯 El Francotirador',
]

function assignSecretTitles(firestoreUsers) {
  const titles = {}
  const claimed = new Set()

  const claim = (userId, title) => {
    if (!claimed.has(title) && !titles[userId]) {
      titles[userId] = title
      claimed.add(title)
      return true
    }
    return false
  }

  if (firestoreUsers?.length) {
    // Biggest debtor (most fines)
    const byFines = [...firestoreUsers].sort(
      (a, b) => (b.walletBalance || 0) - (a.walletBalance || 0)
    )
    if ((byFines[0]?.walletBalance || 0) > 0) {
      claim(byFines[0].id, '💸 El Gran Deudor')
    }

    // Longest streak
    const byStreak = [...firestoreUsers].sort(
      (a, b) => (b.consecutiveSuccesses || 0) - (a.consecutiveSuccesses || 0)
    )
    if ((byStreak[0]?.consecutiveSuccesses || 0) >= 2) {
      claim(byStreak[0].id, '🔥 El Imparable')
    }

    // Shield holder → untouchable
    firestoreUsers.forEach(u => {
      if (u.hasShield) claim(u.id, '🛡️ El Intocable')
    })

    // Most extra lives banked → strategist
    const byLives = [...firestoreUsers].sort(
      (a, b) => (b.extraLives || 0) - (a.extraLives || 0)
    )
    if ((byLives[0]?.extraLives || 0) > 0) {
      claim(byLives[0].id, '⚡ El Estratega')
    }

    // Consecutive misses → dormilón
    const byMisses = [...firestoreUsers].sort(
      (a, b) => (b.consecutiveMisses || 0) - (a.consecutiveMisses || 0)
    )
    if ((byMisses[0]?.consecutiveMisses || 0) > 0) {
      claim(byMisses[0].id, '😴 El Dormilón Oficial')
    }
  }

  // Fallbacks for anyone without a title yet
  let fi = 0
  USERS.forEach(u => {
    if (!titles[u.id]) {
      titles[u.id] = FALLBACK_TITLES[fi++ % FALLBACK_TITLES.length]
    }
  })

  return titles
}

// ─── Confetti pieces ──────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#818cf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#38bdf8', '#fb923c']

function generateConfetti() {
  return Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: `${((i * 3.1 + Math.sin(i * 1.3) * 15 + 50) % 100).toFixed(1)}%`,
    top: `${-10 - (i % 8) * 5}px`,
    delay: `${((i * 0.12) % 2).toFixed(2)}s`,
    duration: `${(2.2 + (i % 6) * 0.3).toFixed(1)}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    width: `${8 + (i % 4) * 3}px`,
    height: `${6 + (i % 3) * 4}px`,
    borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EasterEgg({ users: firestoreUsers, onClose }) {
  const pieces = useMemo(generateConfetti, [])
  const titles = useMemo(() => assignSecretTitles(firestoreUsers), [firestoreUsers])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Confetti rain */}
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: p.top,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* Modal card */}
      <div className="relative bg-gray-900 border border-indigo-500/40 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl shadow-indigo-900/60 z-[101]">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2 animate-bounce">🏆</div>
          <h2 className="text-2xl font-black text-white tracking-tight">¡Modo Leyenda!</h2>
          <p className="text-xs text-indigo-400 mt-1">
            Has encontrado el secreto de FitFamily
          </p>
        </div>

        {/* Secret titles per user */}
        <div className="space-y-2 mb-5">
          {USERS.map(u => {
            const isImg = typeof u.avatar === 'string' && u.avatar.startsWith('/')
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/40 rounded-2xl px-4 py-2.5"
              >
                {isImg ? (
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/40"
                  />
                ) : (
                  <span className="text-2xl w-9 text-center">{u.avatar}</span>
                )}
                <div>
                  <p className="text-sm font-bold text-white">{u.name}</p>
                  <p className="text-xs text-indigo-300">{titles[u.id]}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Secret message */}
        <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-2xl p-3 text-center mb-4">
          <p className="text-xs text-indigo-300 italic leading-relaxed">
            🤫 Eres parte del 1% que encontró esto.<br />
            Comparte el secreto… o guárdalo para ti. 😄
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95"
        >
          Cerrar 🤫
        </button>
      </div>
    </div>
  )
}

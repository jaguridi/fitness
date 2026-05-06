import { useState, useEffect } from 'react'

/**
 * Confetti celebration overlay.
 * Renders animated particles + a message, then auto-dismisses.
 *
 * @param {'goal'|'life'|'shield'|'overachiever'} type - celebration type
 * @param {Function} onDone - called when animation completes
 */

const CELEBRATIONS = {
  goal: {
    title: '🎉 ¡Meta cumplida!',
    subtitle: 'Completaste las sesiones de esta semana',
    colors: ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#f59e0b'],
  },
  life: {
    title: '❤️ ¡Vida extra ganada!',
    subtitle: '5+ sesiones esta semana. ¡Increíble!',
    colors: ['#ef4444', '#f87171', '#fca5a5', '#fb923c', '#fbbf24'],
  },
  shield: {
    title: '🛡️ ¡Escudo activado!',
    subtitle: '4 semanas seguidas. Tu próxima multa será -50%',
    colors: ['#06b6d4', '#22d3ee', '#67e8f9', '#818cf8', '#a78bfa'],
  },
  overachiever: {
    title: '🦸 ¡Sobrehumano!',
    subtitle: '5+ sesiones en una semana. Eres una máquina.',
    colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#a855f7', '#c084fc'],
  },
}

const PARTICLE_COUNT = 60

function createParticles(colors) {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,          // % from left
    delay: Math.random() * 0.8,       // seconds
    duration: 1.5 + Math.random() * 2, // seconds
    size: 4 + Math.random() * 8,       // px
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
    drift: -30 + Math.random() * 60,   // horizontal drift px
  }))
}

export default function Confetti({ type = 'goal', onDone }) {
  const [visible, setVisible] = useState(true)
  const celebration = CELEBRATIONS[type] || CELEBRATIONS.goal
  const [particles] = useState(() => createParticles(celebration.colors))

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 3500)
    return () => clearTimeout(timer)
  }, [onDone])

  // Vibrate on mount (mobile)
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100])
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}

      {/* Message overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div
          className="text-center px-8 py-6 rounded-3xl bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 shadow-2xl"
          style={{ animation: 'confetti-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        >
          <div className="text-5xl mb-2">{celebration.title.split(' ')[0]}</div>
          <h3 className="text-xl font-black text-white mb-1">
            {celebration.title.split(' ').slice(1).join(' ')}
          </h3>
          <p className="text-sm text-gray-400">{celebration.subtitle}</p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.3);
            opacity: 0;
          }
        }
        @keyframes confetti-pop {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

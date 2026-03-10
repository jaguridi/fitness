import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { USERS } from '../constants'

// ── Game items with weighted spawn probability ─────────────────────────────────
const COLLECTIBLES = [
  { emoji: '💪', type: 'good', points: 10, weight: 3 },
  { emoji: '🥦', type: 'good', points: 5,  weight: 3 },
  { emoji: '🏋️', type: 'good', points: 15, weight: 2 },
  { emoji: '⭐', type: 'good', points: 25, weight: 1 },
  { emoji: '🍕', type: 'bad',  points: 0,  weight: 3 },
  { emoji: '🍺', type: 'bad',  points: 0,  weight: 2 },
  { emoji: '🎂', type: 'bad',  points: 0,  weight: 2 },
  { emoji: '🛡️', type: 'shield', points: 0, weight: 0.5 },
]
const TOTAL_WEIGHT = COLLECTIBLES.reduce((s, c) => s + c.weight, 0)

function pickRandom() {
  let r = Math.random() * TOTAL_WEIGHT
  for (const c of COLLECTIBLES) {
    r -= c.weight
    if (r <= 0) return { ...c }
  }
  return { ...COLLECTIBLES[0] }
}

// ── Constants ──────────────────────────────────────────────────────────────────
const LANES = 3
const PLAYER_Y = 84
const COLLISION_RANGE = 5

function laneX(lane) {
  return ((lane + 0.5) / LANES) * 100
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function MiniGame({ currentUser, onClose }) {
  const containerRef = useRef(null)
  const frameRef = useRef(null)
  const prevTs = useRef(0)

  // Mutable game state (ref avoids stale closures in rAF loop)
  const g = useRef({
    playerLane: 1,
    playerX: laneX(1),
    items: [],
    popups: [],
    score: 0,
    lives: 3,
    combo: 0,
    maxCombo: 0,
    speed: 150,
    spawnCD: 0.6,
    spawnRate: 1.2,
    shieldLeft: 0,
    elapsed: 0,
    nextId: 0,
    flash: null,
    flashCD: 0,
    isNewRecord: false,
  })

  // React state drives rendering and the game loop lifecycle
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [ui, setUi] = useState({
    playerX: laneX(1),
    items: [],
    popups: [],
    score: 0,
    lives: 3,
    combo: 0,
    shielded: false,
    flash: null,
  })

  const [best, setBest] = useState(() =>
    parseInt(localStorage.getItem('fitfamily_game_best') || '0', 10),
  )

  const user = useMemo(
    () => USERS.find(u => u.id === currentUser?.id) || USERS[0],
    [currentUser],
  )
  const isImg = typeof user.avatar === 'string' && user.avatar.startsWith('/')

  // ── Actions ──────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    Object.assign(g.current, {
      playerLane: 1,
      playerX: laneX(1),
      items: [],
      popups: [],
      score: 0,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      speed: 150,
      spawnCD: 0.6,
      spawnRate: 1.2,
      shieldLeft: 0,
      elapsed: 0,
      nextId: 0,
      flash: null,
      flashCD: 0,
      isNewRecord: false,
    })
    prevTs.current = 0
    setPhase('playing') // triggers the game loop effect
  }, [])

  const move = useCallback((dir) => {
    if (dir === 'left' && g.current.playerLane > 0) g.current.playerLane--
    if (dir === 'right' && g.current.playerLane < LANES - 1) g.current.playerLane++
  }, [])

  // ── Game loop — only runs while phase === 'playing' ────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    const tick = (ts) => {
      if (!prevTs.current) prevTs.current = ts
      const dt = Math.min((ts - prevTs.current) / 1000, 0.05)
      prevTs.current = ts
      const s = g.current

      s.elapsed += dt

      // Difficulty ramp
      s.speed = 150 + s.elapsed * 8
      s.spawnRate = Math.max(0.4, 1.2 - s.elapsed * 0.012)

      // Smooth player slide
      const tx = laneX(s.playerLane)
      s.playerX += (tx - s.playerX) * Math.min(1, dt * 16)

      // Timers
      if (s.shieldLeft > 0) s.shieldLeft -= dt
      if (s.flash) {
        s.flashCD -= dt
        if (s.flashCD <= 0) s.flash = null
      }

      // Spawn
      s.spawnCD -= dt
      if (s.spawnCD <= 0) {
        s.spawnCD = s.spawnRate
        const item = pickRandom()
        const lane = Math.floor(Math.random() * LANES)
        s.items.push({
          id: s.nextId++,
          lane,
          x: laneX(lane),
          y: -6,
          ...item,
        })
      }

      // Move items + collisions
      const h = containerRef.current?.clientHeight || 700
      const fallPct = (s.speed / h) * 100

      for (const it of s.items) {
        it.y += fallPct * dt

        // Hit detection
        if (
          it.y > PLAYER_Y - COLLISION_RANGE &&
          it.y < PLAYER_Y + COLLISION_RANGE &&
          it.lane === s.playerLane
        ) {
          if (it.type === 'good') {
            const mult = 1 + Math.floor(s.combo / 5)
            const pts = it.points * mult
            s.score += pts
            s.combo++
            s.maxCombo = Math.max(s.maxCombo, s.combo)
            s.flash = 'good'
            s.flashCD = 0.12
            s.popups.push({
              id: s.nextId++,
              x: it.x,
              y: it.y,
              text: `+${pts}`,
              life: 0.7,
            })
          } else if (it.type === 'bad') {
            if (s.shieldLeft > 0) {
              s.flash = 'shield'
              s.flashCD = 0.15
              s.popups.push({
                id: s.nextId++,
                x: it.x,
                y: it.y,
                text: '🛡️',
                life: 0.5,
              })
            } else {
              s.lives--
              s.combo = 0
              s.flash = 'bad'
              s.flashCD = 0.25
              if (s.lives <= 0) {
                const prev = parseInt(
                  localStorage.getItem('fitfamily_game_best') || '0',
                  10,
                )
                s.isNewRecord = s.score > prev
                if (s.isNewRecord) {
                  localStorage.setItem('fitfamily_game_best', String(s.score))
                  setBest(s.score)
                }
                // Stop the loop, show game over
                setPhase('over')
                setUi({
                  playerX: s.playerX,
                  items: [],
                  popups: [],
                  score: s.score,
                  lives: 0,
                  combo: 0,
                  shielded: false,
                  flash: 'bad',
                })
                return // exit tick — effect cleanup cancels the frame
              }
            }
          } else if (it.type === 'shield') {
            s.shieldLeft = 5
            s.flash = 'shield'
            s.flashCD = 0.2
            s.popups.push({
              id: s.nextId++,
              x: it.x,
              y: it.y,
              text: '🛡️ x5s',
              life: 0.8,
            })
          }

          it.y = 999 // mark for removal
        }
      }

      // Animate popups
      for (const p of s.popups) {
        p.y -= 25 * dt
        p.life -= dt
      }

      // Prune
      s.items = s.items.filter((i) => i.y < 110)
      s.popups = s.popups.filter((p) => p.life > 0)

      // Sync to React
      setUi({
        playerX: s.playerX,
        items: s.items.map((i) => ({
          id: i.id,
          x: i.x,
          y: i.y,
          emoji: i.emoji,
          type: i.type,
        })),
        popups: s.popups.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          text: p.text,
          opacity: Math.min(1, p.life * 2.5),
        })),
        score: s.score,
        lives: s.lives,
        combo: s.combo,
        shielded: s.shieldLeft > 0,
        flash: s.flash,
      })

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [phase])

  // ── Input ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') move('left')
      else if (e.key === 'ArrowRight' || e.key === 'd') move('right')
      else if ((e.key === ' ' || e.key === 'Enter') && phase !== 'playing')
        start()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move, start, onClose, phase])

  const handleTap = useCallback(
    (e) => {
      if (phase !== 'playing') return
      const x = e.touches?.[0]?.clientX ?? e.clientX
      if (x < window.innerWidth / 2) move('left')
      else move('right')
    },
    [move, phase],
  )

  // ── Flash background ────────────────────────────────────────────────────────
  const bg =
    ui.flash === 'good'
      ? '#052e1640'
      : ui.flash === 'bad'
        ? '#450a0a50'
        : ui.flash === 'shield'
          ? '#1e1b4b40'
          : '#030712'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] select-none overflow-hidden"
      style={{ background: bg, transition: 'background 0.1s', touchAction: 'none' }}
      onTouchStart={(e) => {
        if (e.target.closest('button')) return
        e.preventDefault()
        handleTap(e)
      }}
      onClick={handleTap}
    >
      {/* Lane dividers */}
      {Array.from({ length: LANES - 1 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-gray-700/20"
          style={{ left: `${((i + 1) / LANES) * 100}%` }}
        />
      ))}

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="text-lg">
              {i < ui.lives ? '❤️' : '🖤'}
            </span>
          ))}
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-white tabular-nums">
            {ui.score}
          </div>
          {ui.combo >= 3 && (
            <div className="text-[10px] text-amber-400 font-bold animate-pulse">
              x{1 + Math.floor(ui.combo / 5)} COMBO {ui.combo}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="text-gray-500 hover:text-white text-lg w-8 h-8 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Shield indicator */}
      {ui.shielded && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 text-xs text-indigo-300 font-bold animate-pulse">
          🛡️ Escudo activo
        </div>
      )}

      {/* ── Falling items ───────────────────────────────────────────────────── */}
      {ui.items.map((it) => (
        <div
          key={it.id}
          className="absolute pointer-events-none"
          style={{
            left: `${it.x}%`,
            top: `${it.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '1.8rem',
            filter:
              it.type === 'bad'
                ? 'drop-shadow(0 0 6px rgba(239,68,68,0.5))'
                : it.type === 'shield'
                  ? 'drop-shadow(0 0 8px rgba(129,140,248,0.7))'
                  : 'drop-shadow(0 0 6px rgba(52,211,153,0.5))',
          }}
        >
          {it.emoji}
        </div>
      ))}

      {/* ── Score popups ─────────────────────────────────────────────────────── */}
      {ui.popups.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none text-sm font-black text-emerald-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: 'translateX(-50%)',
            opacity: p.opacity,
            textShadow: '0 0 8px rgba(16,185,129,0.6)',
          }}
        >
          {p.text}
        </div>
      ))}

      {/* ── Player avatar ───────────────────────────────────────────────────── */}
      <div
        className="absolute z-20"
        style={{
          left: `${ui.playerX}%`,
          top: `${PLAYER_Y}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.07s ease-out',
        }}
      >
        {ui.shielded && (
          <div className="absolute -inset-3 rounded-full border-2 border-indigo-400/60 animate-pulse" />
        )}
        {isImg ? (
          <img
            src={user.avatar}
            alt={user.name}
            draggable={false}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/60"
          />
        ) : (
          <span className="text-4xl">{user.avatar}</span>
        )}
      </div>

      {/* Direction hints */}
      {phase === 'playing' && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
          <span className="text-2xl opacity-15">◀</span>
          <span className="text-2xl opacity-15">▶</span>
        </div>
      )}

      {/* ── Ready screen ────────────────────────────────────────────────────── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80">
          <div className="text-center px-8 max-w-xs">
            <div className="text-6xl mb-3">🏃‍♂️</div>
            <h2 className="text-2xl font-black text-white mb-2">
              FitFamily Dash
            </h2>
            <p className="text-sm text-gray-400 mb-1">
              Atrapa 💪🥦🏋️⭐ y esquiva 🍕🍺🎂
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Toca izquierda / derecha para moverte
            </p>
            {best > 0 && (
              <p className="text-xs text-amber-400 mb-4">
                🏆 Mejor: {best}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                start()
              }}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95"
            >
              ¡Jugar!
            </button>
          </div>
        </div>
      )}

      {/* ── Game over screen ────────────────────────────────────────────────── */}
      {phase === 'over' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-sm">
          <div className="text-center px-8 max-w-xs">
            <div className="text-6xl mb-3">
              {g.current.isNewRecord ? '🎉' : '💀'}
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {g.current.isNewRecord ? '¡Nuevo récord!' : 'Game Over'}
            </h2>
            <div className="text-4xl font-black text-indigo-400 mb-1">
              {g.current.score}
            </div>
            <p className="text-sm text-gray-400 mb-1">puntos</p>
            {g.current.maxCombo >= 3 && (
              <p className="text-xs text-amber-400 mb-3">
                Mejor combo: x{g.current.maxCombo}
              </p>
            )}
            {best > 0 && !g.current.isNewRecord && (
              <p className="text-xs text-gray-500 mb-3">
                🏆 Récord: {best}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  start()
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95"
              >
                Reintentar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-all active:scale-95"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

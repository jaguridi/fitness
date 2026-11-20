import { useId, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'
import { Button, Sticker, RARITY_LABEL, hashString, memberProps, useModal, cx } from '../../components/ui'
import './celebration.css'

/** Cuánta floritura recibe cada rareza. */
const FLOURISH = {
  comun: { bits: 10, rings: 1, burst: false, reach: 96 },
  rara: { bits: 14, rings: 1, burst: false, reach: 110 },
  epica: { bits: 18, rings: 2, burst: true, reach: 120 },
  legendaria: { bits: 26, rings: 2, burst: true, reach: 132 },
}

/** Papelitos deterministas para una lámina (mismos ángulos cada vez). */
export function confettiBits(id, rarity) {
  const f = FLOURISH[rarity] || FLOURISH.comun
  const colors = [`var(--rar-${rarity})`, `var(--rar-${rarity}-print)`, 'var(--member)', 'var(--sticker-edge)']
  const bits = []
  let h = hashString(String(id))
  for (let i = 0; i < f.bits; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const jitter = ((h % 1000) / 1000 - 0.5) * 0.5
    const angle = (i / f.bits) * Math.PI * 2 + jitter
    const dist = f.reach * (0.72 + ((h >>> 10) % 100) / 360)
    const kind = i % 3
    bits.push({
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist * 0.85),
      spin: ((h >>> 4) % 540) - 270,
      w: kind === 2 ? 12 : 8,
      h: kind === 2 ? 5 : 8,
      br: kind === 0 ? 9999 : 2,
      color: colors[i % colors.length],
      delay: (h >>> 20) % 90,
    })
  }
  return bits
}

function Burst({ rarity }) {
  const rays = []
  const n = rarity === 'legendaria' ? 18 : 14
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const b = a + Math.PI / n / 1.3
    rays.push(`M150 150L${(150 + 160 * Math.cos(a)).toFixed(1)} ${(150 + 160 * Math.sin(a)).toFixed(1)}L${(150 + 160 * Math.cos(b)).toFixed(1)} ${(150 + 160 * Math.sin(b)).toFixed(1)}Z`)
  }
  return (
    <div className="celebrate-burst" aria-hidden="true">
      <svg width="300" height="300" viewBox="0 0 300 300">
        <path d={rays.join('')} fill={`var(--rar-${rarity})`} opacity={rarity === 'legendaria' ? 0.55 : 0.4} />
      </svg>
    </div>
  )
}

/**
 * Escenario de una lámina: el hueco con su número y la lámina que se pega encima.
 * Se vuelve a montar (key) para cada lámina de la cola.
 */
function Stage({ achievement }) {
  const { id, icon, name, number, rarity } = achievement
  const f = FLOURISH[rarity] || FLOURISH.comun
  const bits = useMemo(() => confettiBits(id, rarity), [id, rarity])
  return (
    <div
      className="celebrate-stage -mx-6 bg-surface-sunk"
      data-rarity={rarity}
      style={{ '--celebrate-accent': `var(--rar-${rarity}-print)` }}
    >
      {f.burst && <Burst rarity={rarity} />}
      <div className="celebrate-slot">
        <Sticker id={id} number={number} name={name} earned={false} size={152} showLabel={false} />
      </div>
      {Array.from({ length: f.rings }, (_, i) => (
        <span key={i} aria-hidden="true" className="celebrate-ring" data-second={i ? '' : undefined} />
      ))}
      <div className="celebrate-sticker">
        <Sticker id={id} icon={icon} name={name} number={number} rarity={rarity} earned size={152} showLabel={false} />
      </div>
      {bits.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="celebrate-bit"
          style={{
            '--dx': `${b.dx}px`,
            '--dy': `${b.dy}px`,
            '--spin': `${b.spin}deg`,
            '--w': `${b.w}px`,
            '--h': `${b.h}px`,
            '--br': `${b.br}px`,
            '--c': b.color,
            '--delay': `${b.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * La celebración de una lámina nueva: pantalla completa sobre la cortina, el hueco
 * del álbum y la lámina que se pega. Escape o "Seguir" pasan a la siguiente.
 *
 * @param {object} achievement   definición ({ id, icon, name, number, rarity, description })
 * @param {string} userId        quien la ganó (su color en los papelitos)
 * @param {number} position      1-based dentro de la cola
 * @param {number} total
 * @param {() => void} onNext
 * @param {() => void} onOpenAlbum
 */
export default function StickCelebration({ achievement, userId, position = 1, total = 1, onNext, onOpenAlbum }) {
  const panelRef = useModal(true, onNext)
  const titleId = useId()
  const descId = useId()
  const rarity = RARITY_LABEL[achievement.rarity] ? achievement.rarity : 'comun'
  const a = { ...achievement, rarity }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" {...memberProps(userId)}>
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-scrim" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="celebrate-panel relative w-full max-w-sm animate-dialog-in overflow-hidden rounded-sheet bg-surface px-6 pt-5 pb-6 text-center text-ink shadow-lift outline-none"
      >
        <div className="flex h-7 items-center justify-between">
          <p className="type-small font-semibold text-ink-soft">¡Lámina nueva!</p>
          {total > 1 && (
            <p className="type-small rounded-full bg-surface-sunk px-2.5 py-0.5 font-semibold tabular-nums text-ink-soft">
              {position} de {total}
            </p>
          )}
        </div>

        <div className="mt-3">
          <Stage key={a.id} achievement={a} />
        </div>

        <div key={`t-${a.id}`} className="celebrate-text mt-5">
          <p className="type-small font-semibold tabular-nums" style={{ color: `var(--rar-${rarity}-ink)` }}>
            {RARITY_LABEL[rarity]}, lámina {a.number}
          </p>
          <h2 id={titleId} className="type-title mt-1 text-ink">
            {a.name}
          </h2>
          <p id={descId} className="type-body mx-auto mt-2 max-w-[30ch] text-ink-soft">
            {a.description}
          </p>
        </div>
        <p className="sr-only" aria-live="polite">
          Ganaste la lámina {a.name}
        </p>

        <div className={cx('celebrate-actions mt-6 flex flex-col gap-2')}>
          <Button block size="lg" onClick={onNext} data-autofocus>
            Seguir
          </Button>
          <Button block variant="ghost" icon={BookOpen} onClick={onOpenAlbum}>
            Verla en el álbum
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

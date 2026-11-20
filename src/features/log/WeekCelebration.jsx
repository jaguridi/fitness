import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { Avatar, Button, memberProps, useModal } from '../../components/ui'
import { useMemberWeek } from '../../data/FamilyDataProvider'
import { plural } from '../today/todayCopy'

const AUTO_CLOSE_MS = 7000
const RING = { avatar: 104, stroke: 9, pad: 6 }
const OUTER = RING.avatar + 2 * (RING.stroke + RING.pad)

// Trozos de papel que saltan desde el anillo: ángulo (grados), distancia, forma y color.
const PIECES = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5 + (i % 2 ? 8 : -6),
  dist: 92 + ((i * 37) % 5) * 9,
  shape: ['dot', 'bar', 'ring', 'dot'][i % 4],
  color: ['var(--member)', 'var(--done)', 'var(--member)', 'var(--ink)'][i % 4],
  spin: (i % 2 ? 1 : -1) * (90 + ((i * 53) % 4) * 45),
}))

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Celebración corta al lograr la semana (o pasarse de la meta) con el ejercicio recién
 * registrado: el último segmento del anillo se llena en el color de la persona, aparece
 * el check verde y saltan unos trozos de papel. Con movimiento reducido, sin animación.
 * Se cierra con "Seguir", tocando fuera, con Escape o sola a los 7 s.
 */
export default function WeekCelebration({ userId, kind, sessions, goal, extras, onClose }) {
  const week = useMemberWeek(userId)
  const panelRef = useModal(true, onClose)
  const titleId = useId()
  const [full, setFull] = useState(false)
  const burstRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setFull(true), prefersReducedMotion() ? 0 : 320)
    const close = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => {
      clearTimeout(t)
      clearTimeout(close)
    }
  }, [onClose])

  useEffect(() => {
    if (!full || prefersReducedMotion() || !burstRef.current) return
    const els = [...burstRef.current.children]
    const anims = els.map((el, i) => {
      const p = PIECES[i]
      const rad = (p.angle * Math.PI) / 180
      const x = Math.cos(rad) * p.dist
      const y = Math.sin(rad) * p.dist
      return el.animate?.(
        [
          { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.4)', opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${p.spin}deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `translate(-50%, -50%) translate(${x * 1.08}px, ${y * 1.08 + 14}px) rotate(${p.spin * 1.3}deg) scale(0.9)`, opacity: 0 },
        ],
        { duration: 1100, delay: (i % 4) * 30, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      )
    })
    return () => anims.forEach((a) => a?.cancel())
  }, [full])

  const streak = week?.streak || 0
  const n = Math.max(1, Math.min(7, goal))
  const filled = full ? Math.min(sessions, n) : Math.min(sessions - 1, n)
  const r = (OUTER - RING.stroke) / 2
  const c = OUTER / 2
  const circumference = 2 * Math.PI * r
  const gap = n === 1 ? 0 : 9
  const segLen = circumference / n - gap

  const title = kind === 'met' ? '¡Semana lograda!' : extras === 1 ? 'Una sesión extra' : `${extras} sesiones extra`
  const body =
    kind === 'met'
      ? `${sessions} de ${goal} sesiones.${streak > 0 ? ` Racha de ${plural(streak, 'semana', 'semanas')}.` : ''}`
      : `Ya tenías la semana lograda. Llevas ${sessions} sesiones, ${extras} más que tu meta.`

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" {...memberProps(userId)}>
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm animate-dialog-in overflow-hidden rounded-sheet bg-surface text-ink shadow-lift outline-none"
      >
        <div className="relative flex justify-center bg-member-tint pt-9 pb-7">
          <div className="relative" style={{ width: OUTER, height: OUTER }}>
            <svg width={OUTER} height={OUTER} viewBox={`0 0 ${OUTER} ${OUTER}`} className="absolute inset-0" aria-hidden="true">
              <g transform={`rotate(-90 ${c} ${c})`}>
                {Array.from({ length: n }, (_, i) => (
                  <circle
                    key={i}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={i < filled ? 'var(--member)' : 'var(--line-strong)'}
                    strokeWidth={RING.stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${segLen} ${circumference - segLen}`}
                    strokeDashoffset={-(i * (circumference / n) + gap / 2)}
                    style={{ transition: 'stroke 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                  />
                ))}
              </g>
            </svg>
            <Avatar
              userId={userId}
              src={week?.avatar || week?.member?.avatar}
              name=""
              size={RING.avatar}
              className="absolute"
              style={{ left: RING.stroke + RING.pad, top: RING.stroke + RING.pad }}
            />
            {full && (
              <span
                aria-hidden="true"
                className="absolute right-0 bottom-0 inline-flex size-10 animate-pop items-center justify-center rounded-full bg-done text-surface"
                style={{ boxShadow: '0 0 0 4px var(--member-tint)' }}
              >
                {kind === 'extra' ? (
                  <span className="text-sm font-extrabold tabular-nums">+{extras}</span>
                ) : (
                  <Check size={24} strokeWidth={3.2} />
                )}
              </span>
            )}
            <div ref={burstRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
              {PIECES.map((p, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 left-1/2 block opacity-0"
                  style={
                    p.shape === 'bar'
                      ? { width: 12, height: 5, borderRadius: 3, background: p.color }
                      : p.shape === 'ring'
                        ? { width: 10, height: 10, borderRadius: 999, border: `2.5px solid ${p.color}` }
                        : { width: 8, height: 8, borderRadius: 999, background: p.color }
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pt-5 pb-6">
          <h2 id={titleId} className="type-title text-ink">
            {title}
          </h2>
          <p className="type-body mt-2 tabular-nums text-ink-soft">{body}</p>
          <Button block size="lg" className="mt-6" onClick={onClose} data-autofocus>
            Seguir
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

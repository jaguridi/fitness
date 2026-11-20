import { Check, Moon } from 'lucide-react'
import Avatar, { AVATAR_SIZES } from './Avatar'
import { cx } from './cx'
import { memberProps } from './member'

/**
 * AvatarRing — avatar rodeado del anillo **segmentado** de la semana: un segmento por
 * sesión de la meta, en el color de la persona, que se llena al registrar.
 *
 *   <AvatarRing userId="user1" src="/avatars/jose.png" name="Jose" segments={3} filled={2} />
 *   <AvatarRing … segments={3} filled={3} />          // lograda: anillo continuo + check verde
 *   <AvatarRing … segments={4} filled={0} rest />      // semana de descanso: punteado + luna
 *   <AvatarRing … size="xl" />                          // 88 px de avatar (el anillo suma ~14 px)
 *
 * @param {string} userId
 * @param {string} src     avatar (ruta o emoji)
 * @param {string} name
 * @param {number} [segments=3] meta semanal (1–7)
 * @param {number} [filled=0]   sesiones de la semana (puede pasar la meta)
 * @param {boolean} [rest]      semana de descanso
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} [size='md'] tamaño del avatar interior
 * @param {boolean} [badge=true] muestra el distintivo de lograda/descanso (oculto bajo 36 px).
 *   El distintivo se recorta contra el papel; sobre una Surface pon style={{'--ring-bg':'var(--surface)'}}
 *   en un ancestro.
 */
export default function AvatarRing({
  userId,
  src,
  name = '',
  segments = 3,
  filled = 0,
  rest = false,
  size = 'md',
  badge = true,
  className,
}) {
  const inner = typeof size === 'number' ? size : AVATAR_SIZES[size] || AVATAR_SIZES.md
  const stroke = Math.max(3, Math.round(inner * 0.075))
  const pad = Math.max(2, Math.round(inner * 0.05))
  const outer = inner + 2 * (stroke + pad)
  const r = (outer - stroke) / 2
  const c = outer / 2
  const n = Math.max(1, Math.min(7, Math.round(segments) || 1))
  const done = Math.max(0, Math.round(filled) || 0)
  const met = !rest && done >= n
  const circumference = 2 * Math.PI * r
  const gap = n === 1 ? 0 : Math.max(stroke * 1.1, 5)
  const segLen = circumference / n - gap

  const label = rest
    ? `${name}: semana de descanso`
    : met
      ? `${name}: semana lograda, ${done} de ${n} sesiones`
      : `${name}: ${done} de ${n} sesiones`

  const showBadge = badge && inner >= 36 && (met || rest)
  const badgeSize = Math.max(18, Math.round(inner * 0.34))

  return (
    <span
      {...memberProps(userId)}
      role="img"
      aria-label={label}
      className={cx('relative inline-flex shrink-0', className)}
      style={{ width: outer, height: outer }}
    >
      <svg width={outer} height={outer} viewBox={`0 0 ${outer} ${outer}`} className="absolute inset-0" aria-hidden="true">
        {rest ? (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth={Math.max(2, stroke * 0.6)}
            strokeDasharray={`${stroke * 0.9} ${stroke * 1.4}`}
            strokeLinecap="round"
          />
        ) : met ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--member)" strokeWidth={stroke} />
        ) : (
          <g transform={`rotate(-90 ${c} ${c})`}>
            {Array.from({ length: n }, (_, i) => (
              <circle
                key={i}
                className="ring-seg"
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={i < done ? 'var(--member)' : 'var(--line)'}
                strokeWidth={stroke}
                strokeDasharray={`${segLen} ${circumference - segLen}`}
                strokeDashoffset={-(i * (circumference / n) + gap / 2)}
              />
            ))}
          </g>
        )}
      </svg>
      <Avatar
        userId={userId}
        src={src}
        name=""
        size={inner}
        className={cx('absolute', rest && 'opacity-70 grayscale-[0.4]')}
        style={{ left: stroke + pad, top: stroke + pad }}
      />
      {showBadge && (
        <span
          aria-hidden="true"
          className={cx(
            'absolute right-0 bottom-0 inline-flex items-center justify-center rounded-full',
            met ? 'bg-done text-surface' : 'bg-surface-sunk text-ink-soft'
          )}
          style={{ width: badgeSize, height: badgeSize, boxShadow: '0 0 0 3px var(--ring-bg, var(--paper))' }}
        >
          {met ? (
            <Check size={badgeSize * 0.62} strokeWidth={3.2} />
          ) : (
            <Moon size={badgeSize * 0.56} strokeWidth={2.4} />
          )}
        </span>
      )}
    </span>
  )
}

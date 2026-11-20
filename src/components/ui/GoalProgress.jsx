import { Check, Gift } from 'lucide-react'
import ProgressBar from './ProgressBar'
import { Tag } from './Chip'
import { cx } from './cx'
import { memberProps } from './member'

/**
 * GoalProgress — una meta personal con plazo: emoji + título, barra en el color de la
 * persona, avance ("7 de 12 sesiones"), días que quedan y la recompensa si la hay.
 * Es una fila (sin caja): ponla dentro de una Surface o una lista según el contexto.
 *
 *   <GoalProgress userId="user1" emoji="🏃" title="12 sesiones en diciembre"
 *     current={7} target={12} unit="sesiones" daysLeft={11}
 *     reward="las zapatillas nuevas" own />
 *   <GoalProgress … status="achieved" />     // lograda: barra verde y etiqueta
 *   <GoalProgress … status="missed" />       // venció: tono neutro, sin castigo
 *   <GoalProgress … onClick={() => openGoal(goal.id)} />   // fila tocable
 *
 * @param {string} [userId]  color de la barra
 * @param {string} emoji
 * @param {string} title
 * @param {number} current
 * @param {number} target
 * @param {string} [unit]     "sesiones", "minutos", "km", "libros"…
 * @param {number} [daysLeft] días que quedan (0 = vence hoy)
 * @param {string} [reward]   texto libre de la recompensa
 * @param {'active'|'achieved'|'missed'|'cancelled'} [status='active']
 * @param {boolean} [own]    true si es la meta de quien mira: "Si lo logras" en vez de "Si lo logra"
 * @param {()=>void} [onClick]
 */
export default function GoalProgress({
  userId,
  emoji,
  title,
  current = 0,
  target = 1,
  unit = '',
  daysLeft,
  reward,
  status = 'active',
  own = false,
  onClick,
  className,
}) {
  const achieved = status === 'achieved'
  const closed = status === 'missed' || status === 'cancelled'
  const fmt = (n) => Number(n).toLocaleString('es-CL')
  const deadline =
    achieved || closed || daysLeft == null
      ? null
      : daysLeft <= 0
        ? 'Vence hoy'
        : daysLeft === 1
          ? 'Queda 1 día'
          : `Quedan ${daysLeft} días`

  const Tagname = onClick ? 'button' : 'div'
  return (
    <Tagname
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      {...memberProps(userId)}
      className={cx(
        'flex w-full items-start gap-3 text-left',
        onClick && 'rounded-control transition-colors duration-150 hover:bg-ink/4',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-control text-[22px] leading-none',
          achieved ? 'bg-done-soft' : 'bg-member-tint',
          closed && 'grayscale'
        )}
      >
        {emoji || '🎯'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cx('type-body font-semibold leading-snug', closed ? 'text-ink-soft' : 'text-ink')}>{title}</span>
          {achieved && (
            <Tag tone="done" icon={Check} className="mt-0.5 shrink-0">
              Lograda
            </Tag>
          )}
          {status === 'missed' && (
            <Tag tone="outline" className="mt-0.5 shrink-0">
              Venció
            </Tag>
          )}
        </span>
        <ProgressBar
          value={current}
          max={target}
          tone={achieved ? 'done' : closed ? 'ink' : 'member'}
          size="sm"
          label={title}
          className={cx('mt-2', closed && 'opacity-40')}
        />
        <span className="type-small mt-1.5 flex justify-between gap-2 text-ink-soft">
          <span className="tabular-nums">
            {fmt(Math.min(current, achieved ? target : current))} de {fmt(target)}
            {unit ? ` ${unit}` : ''}
          </span>
          {deadline && <span className="shrink-0">{deadline}</span>}
        </span>
        {reward && (
          <span className={cx('type-small mt-1.5 flex items-start gap-1.5', achieved ? 'text-done-ink' : 'text-ink-soft')}>
            <Gift size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {achieved ? (own ? 'Te ganaste: ' : 'Se ganó: ') : own ? 'Si lo logras: ' : 'Si lo logra: '}
              {reward}
            </span>
          </span>
        )}
      </span>
    </Tagname>
  )
}

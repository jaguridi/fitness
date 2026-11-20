import { cx } from './cx'
import { memberProps } from './member'

/**
 * ProgressBar — barra fina de progreso (p. ej. lámina no ganada: "3 de 4 semanas").
 *
 *   <ProgressBar value={3} max={4} label="Constancia" />
 *   <ProgressBar value={120} max={300} userId="user3" />
 *   <ProgressBar value={4} max={4} tone="done" />
 *
 * @param {number} value
 * @param {number} [max=1]
 * @param {'member'|'ink'|'done'} [tone='member'] member usa data-member/userId; sin persona, tinta
 * @param {string} [userId]
 * @param {string} [label] etiqueta accesible
 * @param {'sm'|'md'} [size='md'] 6 / 10 px de alto
 */
const TONES = { member: 'bg-member', ink: 'bg-ink', done: 'bg-done' }

export default function ProgressBar({ value = 0, max = 1, tone = 'member', userId, label, size = 'md', className }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      {...memberProps(userId)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx('w-full overflow-hidden rounded-full bg-surface-sunk', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500 ease-out', TONES[tone] || TONES.member)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

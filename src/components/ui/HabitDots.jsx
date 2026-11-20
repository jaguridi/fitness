import { cx } from './cx'
import { memberProps } from './member'
import { DAY_NAMES } from './WeekStrip'

/**
 * HabitDots — los 7 puntos de la semana de un hábito, conscientes de la meta.
 * Al alcanzar la meta los puntos marcados pasan a verde "logrado".
 *
 *   <HabitDots checks={[true, true, false, true, false, false, false]} target={4} today={3} />
 *   <HabitDots checks={…} target={7} today={3} userId="user2" onToggle={(i) => toggle(habit, i)} />
 *
 * Con onToggle cada punto es un botón de 44×44 px (la fila mide 308 px: ponla en su propia línea); se pueden marcar hoy y los días
 * pasados de la semana, nunca días futuros.
 *
 * @param {boolean[]} checks 7 booleanos, lunes a domingo
 * @param {number} target    días por semana (1–7)
 * @param {number} [today=-1] índice de hoy; -1 = semana pasada (solo lectura aunque haya onToggle)
 * @param {string} [userId]  color mientras no se logra la meta (por defecto tinta)
 * @param {(index:number)=>void} [onToggle]
 * @param {string} [habitName] para las etiquetas accesibles
 * @param {boolean} [showCount=true] muestra "3/4" a la derecha
 */
export default function HabitDots({
  checks = [],
  target = 7,
  today = -1,
  userId,
  onToggle,
  habitName = 'hábito',
  showCount = true,
  className,
}) {
  const count = checks.filter(Boolean).length
  const met = count >= target
  const editable = Boolean(onToggle) && today >= 0
  return (
    <div {...memberProps(userId)} className={cx('flex items-center gap-2', className)}>
      <ol className={cx('flex items-center', editable ? 'gap-0' : 'gap-1.5')} aria-label={`${habitName}, días de la semana`}>
        {Array.from({ length: 7 }, (_, i) => {
          const on = Boolean(checks[i])
          const future = today >= 0 && i > today
          const isToday = i === today
          const dot = (
            <span
              key={on ? 'on' : 'off'}
              className={cx(
                'block rounded-full transition-colors duration-200',
                editable ? 'size-4' : 'size-3',
                on && (met ? 'bg-done' : 'bg-member'),
                on && editable && 'animate-pop',
                !on && !future && 'bg-surface-sunk shadow-[inset_0_0_0_1.5px_var(--line-strong)]',
                !on && future && 'shadow-[inset_0_0_0_1.5px_var(--line)]',
                isToday && !on && 'shadow-[inset_0_0_0_2px_var(--ink)]'
              )}
            />
          )
          const label = `${DAY_NAMES[i]}${isToday ? ' (hoy)' : ''}`
          return (
            <li key={i}>
              {editable ? (
                <button
                  type="button"
                  disabled={future}
                  aria-pressed={on}
                  aria-label={`${habitName}, ${label}`}
                  onClick={() => onToggle(i)}
                  className="inline-flex size-11 items-center justify-center rounded-full disabled:cursor-default disabled:opacity-60"
                >
                  {dot}
                </button>
              ) : (
                <span role="img" aria-label={`${label}: ${on ? 'hecho' : 'sin marcar'}`} className="flex">
                  {dot}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {showCount && (
        <span className={cx('type-caption tabular-nums', met ? 'text-done-ink' : 'text-ink-soft')}>
          {count}/{target}
        </span>
      )}
    </div>
  )
}

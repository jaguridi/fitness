import { Check } from 'lucide-react'
import { cx } from './cx'
import { memberProps } from './member'

/**
 * WeekStrip — la tira L M M J V S D con los días entrenados en el color de la persona.
 *
 *   <WeekStrip userId="user1" days={[1, 0, 1, 0, 0, 0, 0]} today={3} />
 *   <WeekStrip userId="user4" days={[0, 2, 0, 1, 0, 1, 0]} today={-1} size="sm" />   // semana cerrada
 *   <WeekStrip userId="user3" days={…} today={2} onDayClick={(i) => openDay(i)} />
 *
 * @param {Array<number|boolean>} days 7 valores (lunes a domingo): sesiones del día o true/false
 * @param {number} [today=-1] índice de hoy (0 = lunes); -1 si es una semana pasada
 * @param {string} [userId]   color de la persona
 * @param {'sm'|'md'} [size='md'] md = celdas de 36 px, sm = 24 px (listas)
 * @param {(index:number)=>void} [onDayClick] vuelve cada día un botón de 44 px
 */
export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export default function WeekStrip({ days = [], today = -1, userId, size = 'md', onDayClick, className }) {
  const cell = size === 'sm' ? 24 : 36
  return (
    <ol
      {...memberProps(userId)}
      aria-label="Días de la semana"
      className={cx('grid grid-cols-7', size === 'sm' ? 'gap-1' : 'gap-1.5', className)}
    >
      {DAY_LETTERS.map((letter, i) => {
        const count = Number(days[i]) || 0
        const trained = count > 0
        const isToday = i === today
        const future = today >= 0 && i > today
        const label = `${DAY_NAMES[i]}${isToday ? ' (hoy)' : ''}: ${
          trained ? (count > 1 ? `${count} sesiones` : 'entrenaste') : future ? 'por venir' : 'sin sesión'
        }`
        const dot = (
          <span
            className={cx(
              'relative inline-flex items-center justify-center rounded-full tabular-nums font-bold transition-colors duration-200',
              trained && 'bg-member text-on-member',
              !trained && !future && 'bg-surface-sunk',
              !trained && future && 'border-[1.5px] border-dashed border-line-strong',
              isToday && !trained && 'border-2 border-solid border-ink bg-transparent',
              isToday && trained && 'outline-2 outline-offset-2 outline-ink'
            )}
            style={{ width: cell, height: cell, fontSize: size === 'sm' ? 11 : 14 }}
          >
            {trained &&
              (count > 1 ? count : <Check size={size === 'sm' ? 13 : 18} strokeWidth={3} aria-hidden="true" />)}
          </span>
        )
        return (
          <li key={i} className="flex flex-col items-center gap-1.5">
            {size !== 'sm' && (
              <span
                aria-hidden="true"
                className={cx('type-caption', isToday ? 'font-extrabold text-ink' : 'text-ink-soft')}
              >
                {letter}
              </span>
            )}
            {onDayClick ? (
              <button
                type="button"
                aria-label={label}
                onClick={() => onDayClick(i)}
                className="-m-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
              >
                {dot}
              </button>
            ) : (
              <span role="img" aria-label={label}>
                {dot}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

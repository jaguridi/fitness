import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DAY_LETTERS, IconButton, cx, memberProps } from '../../components/ui'
import { MONTH_NAMES, addMonths, monthGrid, monthKey, workoutsByDate } from './memberUtils'

/**
 * A month of someone's workouts: each trained day shows its photo. Tapping a
 * trained day calls onOpenDay(date).
 *
 *   <MonthCalendar userId="user1" workouts={ws} today="2026-11-20" onOpenDay={(d) => …} />
 */
export default function MonthCalendar({ userId, workouts, today, onOpenDay }) {
  const [y, m] = today.split('-').map(Number)
  const current = { year: y, month: m - 1 }
  const [shown, setShown] = useState(current)
  const byDate = useMemo(() => workoutsByDate(workouts), [workouts])
  const firstMonth = useMemo(() => {
    const dates = Object.keys(byDate).sort()
    return dates.length ? monthKey(dates[0]) : monthKey(today)
  }, [byDate, today])

  const key = `${shown.year}-${String(shown.month + 1).padStart(2, '0')}`
  const cells = monthGrid(shown.year, shown.month)
  const canPrev = key > firstMonth
  const canNext = key < monthKey(today)
  const inMonth = cells.filter(Boolean)
  const sessions = inMonth.reduce((s, d) => s + (byDate[d]?.length || 0), 0)
  const days = inMonth.filter((d) => byDate[d]?.length).length
  const monthName = MONTH_NAMES[shown.month]
  const title = `${monthName[0].toUpperCase()}${monthName.slice(1)}${shown.year !== y ? ` ${shown.year}` : ''}`

  return (
    <div {...memberProps(userId)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="type-body font-bold text-ink" aria-live="polite">
            {title}
          </p>
          <p className="type-small text-ink-soft">
            {sessions
              ? `${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}${days < sessions ? ` en ${days} ${days === 1 ? 'día' : 'días'}` : ''}`
              : 'Sin sesiones este mes'}
          </p>
        </div>
        <div className="-mr-2 flex">
          <IconButton icon={ChevronLeft} label="Mes anterior" disabled={!canPrev} onClick={() => setShown((s) => addMonths(s, -1))} />
          <IconButton icon={ChevronRight} label="Mes siguiente" disabled={!canNext} onClick={() => setShown((s) => addMonths(s, 1))} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAY_LETTERS.map((l, i) => (
          <span key={i} aria-hidden="true" className="type-caption pb-1 text-center text-ink-soft">
            {l}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} aria-hidden="true" />
          const list = byDate[d] || []
          const photo = list.find((w) => w.photoURL)?.photoURL
          const isToday = d === today
          const future = d > today
          const dayNum = Number(d.slice(8))
          if (!list.length) {
            return (
              <span
                key={d}
                className={cx(
                  'flex aspect-square items-center justify-center rounded-[10px] text-sm tabular-nums',
                  future ? 'text-ink-faint' : 'text-ink-soft',
                  isToday && 'font-extrabold text-ink shadow-[inset_0_0_0_2px_var(--ink)]'
                )}
              >
                {dayNum}
              </span>
            )
          }
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay?.(d)}
              aria-label={`${dayNum} de ${monthName}: ${list.length === 1 ? '1 sesión' : `${list.length} sesiones`}`}
              className={cx(
                'relative flex aspect-square min-h-11 items-center justify-center overflow-hidden rounded-[10px] bg-member text-sm font-bold text-on-member tabular-nums transition-transform active:scale-95',
                isToday && 'outline-2 outline-offset-2 outline-ink'
              )}
            >
              {photo && <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
              {photo ? (
                <span className="absolute bottom-0.5 left-0.5 rounded-full bg-ink/75 px-1.5 py-0.5 text-[11px] leading-none text-on-ink">
                  {dayNum}
                </span>
              ) : (
                <span className="relative leading-none">{dayNum}</span>
              )}
              {list.length > 1 && (
                <span className="absolute top-0.5 right-0.5 inline-flex size-4 items-center justify-center rounded-full bg-member text-[10px] leading-none text-on-member">
                  {list.length}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

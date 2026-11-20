import { DAY_LETTERS as LETTERS, DAY_NAMES, memberProps } from '../../components/ui'
import { formatNumber, topSports } from './statsHelpers'

/** Barras horizontales por deporte (sesiones), en el color de la persona. */
export function SportBreakdown({ userId, byType }) {
  const list = topSports(byType, 5)
  const max = Math.max(1, ...list.map((t) => t.sessions))
  return (
    <ul {...memberProps(userId)} className="flex flex-col gap-3">
      {list.map((t) => (
        <li key={t.type}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="type-body truncate font-medium text-ink">{t.type}</span>
            <span className="type-small shrink-0 tabular-nums text-ink-soft">
              <span className="font-semibold text-ink">{t.sessions}</span> {t.sessions === 1 ? 'sesión' : 'sesiones'}
              {t.minutes > 0 && `, ${formatNumber(t.minutes)} min`}
            </span>
          </div>
          <span aria-hidden="true" className="mt-1.5 block h-2">
            <span
              className="block h-full rounded-r-[4px] bg-member"
              style={{ width: `${Math.max(2, (t.sessions / max) * 100)}%`, opacity: t.other ? 0.5 : 1 }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Siete columnas L–D con las sesiones de cada día de la semana. */
export function WeekdayBreakdown({ userId, byWeekday, who }) {
  const max = Math.max(0, ...byWeekday)
  const favorite = max > 0 ? byWeekday.indexOf(max) : -1
  return (
    <div {...memberProps(userId)}>
      {favorite >= 0 && (
        <p className="type-small text-ink-soft">
          {who}: <span className="font-semibold text-ink">{DAY_NAMES[favorite]}</span>
        </p>
      )}
      <div className="mt-3 flex h-28 items-end gap-2" role="list" aria-label="Sesiones por día de la semana">
        {byWeekday.map((v, i) => (
          <div
            key={i}
            role="listitem"
            aria-label={`${DAY_NAMES[i]}: ${v} ${v === 1 ? 'sesión' : 'sesiones'}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span aria-hidden="true" className="type-caption tabular-nums text-ink-soft">
              {v}
            </span>
            <span
              aria-hidden="true"
              className="w-full max-w-6 rounded-t-[4px] bg-member"
              style={{ height: max > 0 && v > 0 ? `${Math.max(4, (v / max) * 72)}px` : 0 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-2 border-t border-line-strong pt-1.5">
        {LETTERS.map((l, i) => (
          <span key={i} className="type-caption flex-1 text-center font-semibold text-ink-faint">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

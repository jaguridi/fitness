import { Avatar, cx, memberProps } from '../../components/ui'
import { formatMetric } from './statsHelpers'

/**
 * Ranking amistoso de la familia: una fila por persona con una barra en su color.
 * Sin medallas ni posiciones: el orden ya lo dice, y nadie queda marcado como último.
 * Tocar una fila muestra el detalle de esa persona.
 */
export default function Leaderboard({ rows, metric, currentUserId, selectedId, onSelect }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col" aria-label="Ranking de la familia">
      {rows.map((r) => {
        const pct = max > 0 ? (r.value / max) * 100 : 0
        const selected = r.userId === selectedId
        const you = r.userId === currentUserId
        return (
          <li key={r.userId} {...memberProps(r.userId)}>
            <button
              type="button"
              onClick={() => onSelect?.(r.userId)}
              aria-pressed={selected}
              aria-label={`${you ? 'Tú' : r.member.name}: ${formatMetric(metric, r.value)}. Ver detalle`}
              className={cx(
                '-mx-2 flex min-h-13 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2 text-left transition-colors duration-150',
                selected ? 'bg-surface-sunk' : 'hover:bg-ink/4'
              )}
            >
              <Avatar userId={r.userId} src={r.member.avatar} name="" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="type-body truncate font-semibold text-ink">{you ? 'Tú' : r.member.name}</span>
                  <span className="type-small shrink-0 font-semibold tabular-nums text-ink">
                    {formatMetric(metric, r.value, { short: true })}
                  </span>
                </span>
                <span aria-hidden="true" className="mt-1.5 block h-2.5 w-full">
                  <span
                    className="block h-full rounded-r-[4px] bg-member transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.max(pct, r.value > 0 ? 2 : 0)}%` }}
                  />
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

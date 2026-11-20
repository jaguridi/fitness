import { useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { memberProps } from '../../components/ui'
import { buildHeatmap } from './statsHelpers'

const LEVEL_MIX = [0, 28, 52, 76, 100]

function cellStyle(level) {
  if (!level) return undefined
  return { background: `color-mix(in oklab, var(--member) ${LEVEL_MIX[level]}%, var(--surface-sunk))` }
}

const ROW_LABELS = ['L', '', '', 'J', '', '', 'D']

/**
 * Mapa de actividad: últimas `weeks` semanas, una columna por semana (lunes arriba),
 * intensidad según los minutos del día en el color de la persona.
 */
export default function ActivityHeatmap({ userId, activityByDate, endWeekId, today, weeks = 26 }) {
  const { columns, activeDays } = useMemo(
    () => buildHeatmap(activityByDate, endWeekId, weeks, today),
    [activityByDate, endWeekId, weeks, today]
  )

  // Etiqueta de mes sobre la primera columna de cada mes.
  // Se omite una etiqueta si queda a menos de 3 columnas de la siguiente (no caben).
  const monthMarks = columns.map((c, i) => {
    const d = new Date(`${c.days[0].date}T12:00:00`)
    const prev = i > 0 ? new Date(`${columns[i - 1].days[0].date}T12:00:00`) : null
    return !prev || prev.getMonth() !== d.getMonth() ? format(d, 'MMM', { locale: es }).replace('.', '') : ''
  })
  const starts = monthMarks.map((m, i) => (m ? i : -1)).filter((i) => i >= 0)
  starts.forEach((i, k) => {
    if (starts[k + 1] != null && starts[k + 1] - i < 3) monthMarks[i] = ''
  })

  return (
    <div {...memberProps(userId)}>
      <p className="type-small text-ink-soft">
        <span className="font-semibold tabular-nums text-ink">{activeDays}</span>{' '}
        {activeDays === 1 ? 'día con ejercicio' : 'días con ejercicio'} en los últimos 6 meses
      </p>
      <div className="mt-3 flex gap-1.5" role="img" aria-label={`Mapa de actividad: ${activeDays} días con ejercicio en ${weeks} semanas`}>
        <div aria-hidden="true" className="grid shrink-0 grid-rows-[auto_repeat(7,1fr)] gap-[3px] pr-0.5">
          <span className="type-caption h-4" />
          {ROW_LABELS.map((l, i) => (
            <span key={i} className="flex items-center text-[10px] leading-none font-semibold text-ink-faint">
              {l}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid min-w-0 flex-1 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((c, i) => (
            <div key={c.weekId} className="grid grid-rows-[auto_repeat(7,1fr)] gap-[3px]">
              <span className="relative h-4">
                {monthMarks[i] && (
                  <span className="absolute left-0 top-0 text-[10px] leading-4 font-semibold whitespace-nowrap text-ink-faint">
                    {monthMarks[i]}
                  </span>
                )}
              </span>
              {c.days.map((d) => (
                <span
                  key={d.date}
                  title={
                    d.future
                      ? undefined
                      : `${format(new Date(`${d.date}T12:00:00`), "EEEE d 'de' MMM", { locale: es })}: ${
                          d.sessions ? `${d.sessions} ${d.sessions === 1 ? 'sesión' : 'sesiones'}, ${d.minutes} min` : 'sin ejercicio'
                        }`
                  }
                  className={d.future ? 'aspect-square rounded-[3px]' : 'aspect-square rounded-[3px] bg-surface-sunk'}
                  style={cellStyle(d.level)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="type-caption mt-3 flex items-center justify-end gap-1.5 text-ink-faint">
        Menos
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3 rounded-[3px] bg-surface-sunk" style={cellStyle(l)} />
        ))}
        Más minutos
      </div>
    </div>
  )
}

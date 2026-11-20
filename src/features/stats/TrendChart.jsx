import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { cx, memberProps } from '../../components/ui'
import { formatMetric, formatNumber, niceMax, weekStartLabel } from './statsHelpers'

const STATUS_TEXT = { completed: 'Lograda', missed: 'No salió', rest: 'Descanso', in_progress: 'En curso' }

/**
 * Columnas semanales en el color de la persona (CSS, sin librería).
 * Para sesiones dibuja la meta de cada semana como una marca de tinta sobre la columna.
 * Cada columna es un botón: al tocarla (o enfocarla) se lee el detalle arriba.
 *
 * @param {Array<{ weekId, value, goal, status, met }>} series oldest first
 */
export default function TrendChart({ userId, series, metric, currentWeekId }) {
  const [selected, setSelected] = useState(series.length - 1)
  useEffect(() => setSelected(series.length - 1), [series.length, userId, metric])

  const showGoal = metric === 'sessions'
  const rawTop = niceMax(Math.max(0, ...series.map((s) => s.value), ...(showGoal ? series.map((s) => (s.status === 'rest' ? 0 : s.goal || 0)) : [])))
  // Escalas chicas en números pares para que la línea del medio sea un entero.
  const top = rawTop <= 10 && rawTop % 2 ? rawTop + 1 : rawTop
  const pct = (v) => `${Math.min(100, (Math.max(0, v) / top) * 100)}%`
  const sel = series[selected] || series[series.length - 1]
  const n = series.length

  const describe = (s) => {
    const parts = [`Semana del ${weekStartLabel(s.weekId)}`, formatMetric(metric, s.value)]
    if (showGoal && s.status !== 'rest') parts.push(`meta ${s.goal}`)
    if (STATUS_TEXT[s.status]) parts.push(STATUS_TEXT[s.status].toLowerCase())
    return parts.join(', ')
  }

  return (
    <div {...memberProps(userId)}>
      <p className="type-small min-h-10 text-ink-soft" aria-live="polite">
        {sel && (
          <>
            <span className="font-semibold text-ink">
              {sel.weekId === currentWeekId ? 'Esta semana' : `Semana del ${weekStartLabel(sel.weekId)}`}
            </span>
            <br />
            <span className="tabular-nums">
              {formatMetric(metric, sel.value)}
              {showGoal && sel.status !== 'rest' && ` de ${sel.goal}`}
              {STATUS_TEXT[sel.status] && `. ${STATUS_TEXT[sel.status]}`}
            </span>
          </>
        )}
      </p>

      <div className="relative mt-4 ml-7 h-40" role="group" aria-label="Tendencia semanal">
        {/* Líneas guía: tope y mitad (finas, recesivas) */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} aria-hidden="true" className={cx('absolute inset-x-0 border-t', f === 0 ? 'border-line-strong' : 'border-line')} style={{ bottom: `${f * 100}%` }}>
            <span className="type-caption absolute right-full mr-2 -translate-y-1/2 tabular-nums text-ink-faint">{formatNumber(top * f)}</span>
          </div>
        ))}
        
        <div className="absolute inset-0 flex items-stretch">
          {series.map((s, i) => {
            const isCurrent = s.weekId === currentWeekId
            const rest = s.status === 'rest'
            return (
              <button
                key={s.weekId}
                type="button"
                aria-label={describe(s)}
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
                className={cx(
                  'group relative flex flex-1 justify-center rounded-t-[6px] outline-offset-0 transition-colors',
                  i === selected ? 'bg-ink/5' : 'hover:bg-ink/4'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute bottom-0 w-[58%] max-w-6 rounded-t-[4px] bg-member transition-[height] duration-500 ease-out',
                    isCurrent && 'opacity-55'
                  )}
                  style={{ height: s.value > 0 ? `max(3px, ${pct(s.value)})` : 0 }}
                />
                {showGoal && !rest && s.goal > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute h-0.5 w-[78%] max-w-8 rounded-full bg-ink"
                    style={{ bottom: `calc(${pct(s.goal)} - 1px)` }}
                  />
                )}
                {rest && (
                  <Moon aria-hidden="true" size={14} strokeWidth={2.4} className="absolute bottom-1.5 text-ink-faint" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div aria-hidden="true" className="mt-1.5 ml-7 flex">
        {series.map((s, i) => (
          <span key={s.weekId} className="type-caption flex-1 text-center whitespace-nowrap text-ink-faint">
            {(n - 1 - i) % 4 === 0 ? (s.weekId === currentWeekId ? 'Hoy' : weekStartLabel(s.weekId)) : ''}
          </span>
        ))}
      </div>

      {showGoal && (
        <p className="type-caption mt-3 flex items-center gap-1.5 text-ink-soft">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-ink" />
          Meta de esa semana
          <Moon aria-hidden="true" size={13} strokeWidth={2.4} className="ml-2 text-ink-faint" />
          Descanso
        </p>
      )}
    </div>
  )
}

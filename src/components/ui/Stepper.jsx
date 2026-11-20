import { Minus, Plus } from 'lucide-react'
import { cx } from './cx'

/**
 * Stepper — número pequeño con − y + (meta semanal 1–7, días de un hábito).
 *
 *   <Stepper value={goal} onChange={setGoal} min={1} max={7} label="Meta semanal" unit="sesiones" />
 *   <Stepper value={days} onChange={setDays} min={1} max={7} label="Días por semana" />
 *
 * @param {number} value
 * @param {(next:number)=>void} onChange
 * @param {number} [min=1]
 * @param {number} [max=7]
 * @param {string} label  etiqueta accesible del grupo
 * @param {string|((n:number)=>string)} [unit] texto bajo el número ("sesiones" o n => n === 1 ? 'día' : 'días')
 */
export default function Stepper({ value, onChange, min = 1, max = 7, label, unit, className }) {
  const unitText = typeof unit === 'function' ? unit(value) : unit
  const btn =
    'inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-[background-color,transform] duration-150 hover:bg-surface-sunk active:scale-95 disabled:opacity-35 disabled:active:scale-100'
  return (
    <div role="group" aria-label={label} className={cx('inline-flex items-center gap-3', className)}>
      <button
        type="button"
        className={btn}
        aria-label="Restar uno"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <div className="flex min-w-14 flex-col items-center" aria-live="polite">
        <span key={value} className="animate-pop text-[34px] leading-none font-extrabold tracking-[-0.03em] tabular-nums text-ink">
          {value}
        </span>
        {unitText && <span className="type-caption mt-1 text-ink-soft">{unitText}</span>}
      </div>
      <button
        type="button"
        className={btn}
        aria-label="Sumar uno"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  )
}

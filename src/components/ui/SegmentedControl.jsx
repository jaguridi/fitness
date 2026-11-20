import { useRef } from 'react'
import { cx } from './cx'

/**
 * SegmentedControl — elegir una opción entre 2–4 (tema, periodo de stats, visibilidad).
 * Se navega con flechas (patrón radiogroup).
 *
 *   <SegmentedControl label="Tema" value={pref} onChange={setPref}
 *     options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} />
 *   <SegmentedControl label="Quién lo ve" value={vis} onChange={setVis} options={[
 *     { value: 'family', label: 'La familia', icon: Users }, { value: 'private', label: 'Solo yo', icon: Lock }]} />
 *
 * @param {{value:string,label:string,icon?:React.ComponentType}[]} options
 * @param {string} value
 * @param {(v:string)=>void} onChange
 * @param {string} label etiqueta accesible
 * @param {boolean} [block=true] ocupa todo el ancho
 */
export default function SegmentedControl({ options = [], value, onChange, label, block = true, className }) {
  const refs = useRef([])
  const onKeyDown = (e, i) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('rounded-control bg-surface-sunk p-1', block ? 'flex' : 'inline-flex', className)}
    >
      {options.map((opt, i) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150',
              active
                ? 'bg-surface text-ink shadow-[0_1px_0_var(--line-strong),0_0_0_1px_var(--line)]'
                : 'text-ink-soft hover:text-ink'
            )}
          >
            {Icon && <Icon size={16} strokeWidth={2.3} aria-hidden="true" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

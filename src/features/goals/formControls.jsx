import { ChevronDown, ChevronRight } from 'lucide-react'
import { Field, cx, inputClass } from '../../components/ui'

/**
 * SelectField — a native <select> dressed like TextField (no primitive exists yet).
 *
 *   <SelectField label="Deporte" value={t} onChange={setT}
 *     options={[{ value: '', label: 'Cualquier ejercicio' }, { value: 'Yoga', label: 'Yoga' }]} />
 */
export function SelectField({ label, hint, error, value, onChange, options = [], className }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <SelectControl value={value} onChange={onChange} options={options} error={error} />
    </Field>
  )
}

function SelectControl({ value, onChange, options, error, ...rest }) {
  return (
    <div className="relative">
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass(error), 'h-12 appearance-none pr-10')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={2.3}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-soft"
      />
    </div>
  )
}

/** DateField — native date input with the system's input style. */
export function DateField({ label, value, onChange, min, max, error, className }) {
  return (
    <Field label={label} className={className}>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cx(inputClass(error), 'h-12 [color-scheme:inherit]')}
      />
    </Field>
  )
}

/**
 * TemplateList — the quick goal templates as tappable rows.
 * @param {Array<{ id, emoji, label, description, needsHabit? }>} templates
 * @param {(id:string)=>void} onPick
 * @param {boolean} [hasHabits] disables the habit template when false
 */
export function TemplateList({ templates, onPick, hasHabits = true, className }) {
  return (
    <ul className={cx('flex flex-col', className)}>
      {templates.map((t) => {
        const disabled = t.needsHabit && !hasHabits
        return (
          <li key={t.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(t.id)}
              className="-mx-2 flex min-h-16 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors duration-150 hover:bg-ink/4 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-11 shrink-0 items-center justify-center rounded-control bg-member-tint text-[22px] leading-none',
                  disabled && 'grayscale opacity-60'
                )}
              >
                {t.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('type-body block font-semibold', disabled ? 'text-ink-soft' : 'text-ink')}>{t.label}</span>
                <span className="type-small block text-ink-soft">
                  {disabled ? 'Primero crea un hábito en Hábitos.' : t.description}
                </span>
              </span>
              {!disabled && <ChevronRight size={18} strokeWidth={2.3} aria-hidden="true" className="shrink-0 text-ink-faint" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

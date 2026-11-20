import { useId } from 'react'
import { cx } from './cx'

/**
 * Toggle — interruptor on/off con su etiqueta; toda la fila es el área táctil.
 *
 *   <Toggle checked={prefs.habitReminder} onChange={setReminder}
 *           label="Recordatorio de hábitos" description="A las 20:30, solo si te queda alguno." />
 *   <Toggle checked={isPrivate} onChange={setPrivate} label="Solo yo lo veo" />
 *
 * @param {boolean} checked
 * @param {(next:boolean)=>void} onChange
 * @param {React.ReactNode} label
 * @param {React.ReactNode} [description]
 * @param {boolean} [disabled]
 */
export default function Toggle({ checked = false, onChange, label, description, disabled, className }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cx(
        'flex min-h-11 cursor-pointer items-center justify-between gap-4 py-1.5',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span className="min-w-0">
        <span className="type-body block font-medium text-ink">{label}</span>
        {description && <span className="type-small mt-0.5 block text-ink-soft">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cx(
            'flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200',
            'peer-focus-visible:outline-[2.5px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-focus-visible:outline',
            checked ? 'bg-done' : 'bg-line-strong'
          )}
        >
          <span
            className={cx(
              'size-6 rounded-full bg-white shadow-[0_1px_2px_rgb(14_21_40/0.3)] transition-transform duration-200 ease-[var(--ease-snap)]',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </span>
      </span>
    </label>
  )
}

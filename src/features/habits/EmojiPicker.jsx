import { useId, useState } from 'react'
import { cx } from '../../components/ui'
import { firstGrapheme } from './habitForm'

/**
 * EmojiPicker — a small curated grid of emojis (44 px each) plus a free input
 * to type or paste any other one.
 *
 *   <EmojiPicker value={emoji} onChange={setEmoji} options={HABIT_EMOJIS} label="Emoji del hábito" />
 *
 * @param {string} value
 * @param {(emoji:string)=>void} onChange
 * @param {string[]} options
 * @param {string} label accessible group label
 * @param {string} [error]
 */
export default function EmojiPicker({ value, onChange, options = [], label, error, className }) {
  const inputId = useId()
  const custom = value && !options.includes(value) ? value : ''
  const [draft, setDraft] = useState(custom)
  const shown = draft || custom

  return (
    <div className={className}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((e) => {
          const on = e === value
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={e}
              onClick={() => {
                setDraft('')
                onChange(e)
              }}
              className={cx(
                'inline-flex size-11 items-center justify-center rounded-control text-[22px] leading-none transition-[background-color,box-shadow,transform] duration-150 active:scale-95',
                on ? 'bg-surface-sunk shadow-[inset_0_0_0_2px_var(--ink)]' : 'hover:bg-surface-sunk'
              )}
            >
              {e}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={inputId}
          value={shown}
          onChange={(ev) => {
            const g = firstGrapheme(ev.target.value)
            setDraft(g)
            if (g) onChange(g)
          }}
          inputMode="text"
          autoComplete="off"
          aria-label="Otro emoji"
          aria-invalid={error ? true : undefined}
          className={cx(
            'h-11 w-16 rounded-control border bg-surface text-center text-[22px] text-ink placeholder:opacity-40',
            'focus:outline-none focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]',
            error ? 'border-danger' : shown && shown === value ? 'border-ink' : 'border-line-strong'
          )}
        />
        <label htmlFor={inputId} className="type-small text-ink-soft">
          ¿Otro? Escríbelo o pégalo aquí.
        </label>
      </div>
      {error && <p className="type-small mt-1.5 text-danger">{error}</p>}
    </div>
  )
}

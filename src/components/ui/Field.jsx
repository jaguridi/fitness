import { cloneElement, forwardRef, isValidElement, useId } from 'react'
import { cx } from './cx'

/**
 * Field — etiqueta + control + ayuda/error. TextField y TextArea ya lo traen.
 *
 *   <TextField label="Nombre del hábito" value={name} onChange={(e) => setName(e.target.value)}
 *              placeholder="Leer 20 minutos" />
 *   <TextField label="Minutos" type="number" inputMode="numeric" hint="Opcional" />
 *   <TextArea label="Comentario" rows={3} error="Escribe algo antes de enviar." />
 *   <Field label="Emoji" hint="Toca para elegir"><EmojiPicker … /></Field>
 *
 * Field: label, hint, error, children (un solo control; recibe id y aria-describedby).
 * TextField/TextArea: las mismas props de Field + cualquier prop nativa de input/textarea.
 */
export function Field({ label, hint, error, id: idProp, className, children }) {
  const autoId = useId()
  const id = idProp || autoId
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="type-small font-semibold text-ink">
          {label}
        </label>
      )}
      {control}
      {error ? (
        <p id={`${id}-error`} className="type-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="type-small text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass = (error) =>
  cx(
    'w-full rounded-control border bg-surface px-4 text-base text-ink placeholder:text-ink-faint',
    'transition-[border-color,box-shadow] duration-150',
    'focus:outline-none focus-visible:outline-none focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]',
    error ? 'border-danger' : 'border-line-strong'
  )

export const TextField = forwardRef(function TextField({ label, hint, error, id, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      <input ref={ref} className={cx(inputClass(error), 'h-12')} {...rest} />
    </Field>
  )
})

export const TextArea = forwardRef(function TextArea({ label, hint, error, id, className, rows = 3, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      <textarea ref={ref} rows={rows} className={cx(inputClass(error), 'resize-none py-3 leading-snug')} {...rest} />
    </Field>
  )
})

export default Field

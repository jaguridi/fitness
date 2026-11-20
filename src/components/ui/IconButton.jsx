import { forwardRef } from 'react'
import { cx } from './cx'

/**
 * IconButton — botón solo icono, siempre con `label` (se usa como aria-label y title).
 * Área táctil mínima de 44px aunque el icono sea chico.
 *
 *   <IconButton icon={X} label="Cerrar" onClick={onClose} />
 *   <IconButton icon={ChevronLeft} label="Volver" variant="surface" />
 *   <IconButton icon={Plus} label="Agregar hábito" variant="ink" size="lg" />
 *
 * @param {React.ComponentType} icon icono lucide
 * @param {string} label texto accesible (obligatorio)
 * @param {'ghost'|'surface'|'ink'} [variant='ghost']
 * @param {'md'|'lg'} [size='md'] md = 44px, lg = 52px
 * @param {boolean} [pressed] para botones tipo interruptor (aria-pressed)
 */
const VARIANTS = {
  ghost: 'text-ink-soft hover:text-ink hover:bg-ink/6 active:bg-ink/10',
  surface: 'bg-surface text-ink border border-line hover:bg-surface-sunk',
  ink: 'bg-ink text-on-ink hover:bg-ink/90',
}

const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', pressed, className, type = 'button', ...rest },
  ref
) {
  const px = size === 'lg' ? 'size-13' : 'size-11'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-95 disabled:opacity-40',
        VARIANTS[variant] || VARIANTS.ghost,
        px,
        className
      )}
      {...rest}
    >
      <Icon size={size === 'lg' ? 24 : 20} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
})

export default IconButton

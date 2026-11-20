import { cx } from './cx'

/**
 * Surface — la única "tarjeta". Úsala solo para grupos interactivos; las secciones
 * normales viven directo sobre el papel (ver <Section>).
 *
 *   <Surface>…</Surface>                                  // blanca con línea fina
 *   <Surface variant="sunk">…</Surface>                   // hundida, para grupos secundarios
 *   <Surface variant="tint" {...memberProps('user2')}>…</Surface>  // tinte de la persona
 *   <Surface variant="outline">…</Surface>                // solo contorno, sobre papel
 *   <Surface as="button" onClick={…} interactive>…</Surface>
 *
 * @param {'plain'|'sunk'|'tint'|'outline'} [variant='plain']
 * @param {'none'|'sm'|'md'|'lg'} [padding='md'] 0 / 12 / 16 / 20 px
 * @param {boolean} [interactive] agrega estados hover/active (para as="button" o enlaces)
 * @param {React.ElementType} [as='div']
 */
const VARIANTS = {
  plain: 'bg-surface border border-line',
  sunk: 'bg-surface-sunk',
  tint: 'bg-member-tint',
  outline: 'border border-line-strong',
}

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }

// Lo que hay "detrás" para recortes (p. ej. el distintivo de AvatarRing).
const RING_BG = {
  plain: 'var(--surface)',
  sunk: 'var(--surface-sunk)',
  tint: 'var(--member-tint)',
  outline: 'var(--paper)',
}

export default function Surface({
  as: Tag = 'div',
  variant = 'plain',
  padding = 'md',
  interactive = false,
  className,
  children,
  style,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        'block rounded-surface text-left',
        VARIANTS[variant] || VARIANTS.plain,
        PADDING[padding] ?? PADDING.md,
        interactive &&
          'w-full transition-[transform,background-color,border-color] duration-150 hover:border-line-strong active:scale-[0.99]',
        className
      )}
      style={{ '--ring-bg': RING_BG[variant], ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

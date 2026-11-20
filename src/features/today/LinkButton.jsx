import { Link } from 'react-router-dom'
import { cx } from '../../components/ui'

/**
 * Un enlace de la app con la forma de <Button> (que no admite `as`).
 * Variantes y tamaños equivalentes a Button: secondary | ghost, sm | md.
 * Sugerencia para el sistema: que Button acepte `as={Link}`.
 */
const VARIANTS = {
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunk',
  ghost: 'bg-transparent text-ink hover:bg-ink/6 active:bg-ink/10',
}
const SIZES = {
  sm: 'h-11 px-3.5 text-sm gap-1.5 rounded-[10px]', // 44 px de alto: es un objetivo táctil suelto
  md: 'h-11 px-5 text-base gap-2 rounded-control',
}

export default function LinkButton({ to, variant = 'secondary', size = 'md', icon: Icon, className, children, ...rest }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] whitespace-nowrap',
        'transition-[background-color,color,transform] duration-150 active:scale-[0.98]',
        VARIANTS[variant] || VARIANTS.secondary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2.2} aria-hidden="true" />}
      {children}
    </Link>
  )
}

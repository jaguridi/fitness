import { forwardRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cx } from './cx'

/**
 * Button — el botón dice lo que hace ("Registrar ejercicio", "Guardar hábito").
 *
 *   <Button onClick={save}>Guardar hábito</Button>
 *   <Button variant="secondary" icon={Camera}>Agregar foto</Button>
 *   <Button variant="ghost" size="sm">Cancelar</Button>
 *   <Button variant="danger-quiet" icon={Trash2}>Eliminar ejercicio</Button>
 *   <Button variant="member" {...memberProps('user1')}>Ver perfil de Jose</Button>
 *   <Button loading block>Entrando…</Button>
 *
 * @param {'primary'|'secondary'|'ghost'|'danger-quiet'|'danger'|'member'} [variant='primary']
 *   primary = tinta (el principal de cada pantalla, uno solo), secondary = superficie con borde,
 *   ghost = solo texto, danger-quiet = texto tinta suave que se vuelve rojo apagado al pasar,
 *   danger = sólido, solo para confirmar algo irreversible dentro de un ConfirmDialog,
 *   member = color sólido de la persona del contexto data-member.
 * @param {'sm'|'md'|'lg'} [size='md'] sm 36px (solo en filas densas), md 44px, lg 52px.
 * @param {boolean} [loading] muestra spinner y deshabilita.
 * @param {boolean} [block] ancho completo.
 * @param {React.ComponentType} [icon] icono lucide a la izquierda.
 * @param {React.ComponentType} [iconRight] icono lucide a la derecha (nunca una flecha decorativa).
 */
const VARIANTS = {
  primary: 'bg-ink text-on-ink hover:bg-ink/90 active:bg-ink/80',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunk active:bg-surface-sunk',
  ghost: 'bg-transparent text-ink hover:bg-ink/6 active:bg-ink/10',
  'danger-quiet':
    'bg-transparent text-ink-soft hover:text-danger hover:bg-danger/8',
  member: 'bg-member text-on-member hover:brightness-105 active:brightness-95',
  danger: 'bg-danger text-paper hover:brightness-110 active:brightness-95',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-[10px]',
  md: 'h-11 px-5 text-base gap-2 rounded-control',
  lg: 'h-13 px-6 text-base gap-2 rounded-control',
}

const ICON = { sm: 16, md: 18, lg: 20 }

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    block = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] whitespace-nowrap',
        'transition-[background-color,color,transform,filter] duration-150 active:scale-[0.98]',
        'disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={ICON[size]} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={ICON[size]} strokeWidth={2.2} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={ICON[size]} strokeWidth={2.2} aria-hidden="true" />}
    </button>
  )
})

export default Button

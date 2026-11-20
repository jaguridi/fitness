import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import IconButton from './IconButton'
import { cx } from './cx'

/**
 * PageHeader — titular de página. En "Hoy" el titular es el estado mismo
 * ("Te falta 1 sesión para lograr la semana"), no un rótulo.
 *
 *   <PageHeader title="Familia" />
 *   <PageHeader title="Hábitos" description="Elige qué quieres sostener cada semana." back />
 *   <PageHeader title="Te falta 1 sesión" size="display" leading={<AvatarRing …/>} />
 *
 * @param {React.ReactNode} title
 * @param {React.ReactNode} [description]
 * @param {boolean|string} [back] muestra "Volver"; string = ruta destino, true = historial
 * @param {React.ReactNode} [action] control a la derecha (p. ej. IconButton de ajustes)
 * @param {React.ReactNode} [leading] algo sobre el título (avatar, fecha)
 * @param {'display'|'title'} [size='title'] display = 44px, title = 34px
 */
export default function PageHeader({ title, description, back, action, leading, size = 'title', className }) {
  const navigate = useNavigate()
  return (
    <header className={cx('pt-4 pb-6', className)}>
      {(back || action) && (
        <div className="-mx-2 mb-2 flex h-11 items-center justify-between">
          {back ? (
            <IconButton
              icon={ChevronLeft}
              label="Volver"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            />
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {leading && <div className="mb-4">{leading}</div>}
      <h1 className={cx(size === 'display' ? 'type-display' : 'type-title', 'text-ink')}>{title}</h1>
      {description && <p className="type-body mt-2 max-w-[34ch] text-ink-soft">{description}</p>}
    </header>
  )
}

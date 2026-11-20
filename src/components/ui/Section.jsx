import { useId } from 'react'
import { cx } from './cx'

/**
 * Section — un bloque con título que vive sobre el papel (sin caja).
 *
 *   <Section title="Tus hábitos" action={<Button variant="ghost" size="sm">Editar</Button>}>
 *     …
 *   </Section>
 *   <Section title="La familia esta semana" description="Se cierra el domingo a medianoche.">
 *
 * @param {React.ReactNode} title     encabezado (h2, tamaño type-sub)
 * @param {React.ReactNode} [description] una línea de apoyo en tinta suave
 * @param {React.ReactNode} [action]  un control a la derecha del título
 * @param {'h2'|'h3'} [as='h2']
 */
export default function Section({ title, description, action, as: H = 'h2', className, children, ...rest }) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={cx('mt-9 first:mt-0', className)} {...rest}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <H id={id} className="type-sub text-ink">
                {title}
              </H>
            )}
            {description && <p className="type-small mt-0.5 text-ink-soft">{description}</p>}
          </div>
          {action && <div className="-my-1 shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

import { cx } from './cx'

/**
 * EmptyState — un vacío que invita a actuar. Sobre el papel, alineado a la izquierda.
 *
 *   <EmptyState icon={Sparkles} title="Aún no tienes hábitos"
 *     description="Elige uno chico para empezar: leer 10 minutos, tomar agua, estirar."
 *     action={<Button icon={Plus}>Crear hábito</Button>} />
 *   <EmptyState emoji="📭" title="Nada por aquí todavía" compact />
 *
 * @param {React.ComponentType} [icon] icono lucide (interfaz)
 * @param {string} [emoji] o un emoji si el contenido lo pide
 * @param {React.ReactNode} title
 * @param {React.ReactNode} [description]
 * @param {React.ReactNode} [action]
 * @param {boolean} [compact] menos aire, para dentro de una sección
 */
export default function EmptyState({ icon: Icon, emoji, title, description, action, compact = false, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-start rounded-surface border-[1.5px] border-dashed border-line-strong',
        compact ? 'gap-2 p-4' : 'gap-3 px-5 py-7',
        className
      )}
    >
      {(Icon || emoji) && (
        <span
          aria-hidden="true"
          className={cx(
            'inline-flex items-center justify-center rounded-full bg-surface-sunk text-ink-soft',
            compact ? 'size-10' : 'size-12'
          )}
        >
          {Icon ? <Icon size={compact ? 20 : 22} strokeWidth={2.2} /> : <span className="text-2xl leading-none">{emoji}</span>}
        </span>
      )}
      <div>
        <p className={cx(compact ? 'type-body font-semibold' : 'type-sub', 'text-ink')}>{title}</p>
        {description && <p className="type-small mt-1 max-w-[36ch] text-ink-soft">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

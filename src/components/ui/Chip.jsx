import { cx } from './cx'
import { memberProps } from './member'

/**
 * Chip — opción seleccionable redonda (filtros, tipo de ejercicio, sugerencias de hábitos).
 * Tag — etiqueta estática pequeña (estado, rareza, "Privado").
 *
 *   <Chip selected={type === 'run'} onClick={() => setType('run')} emoji="🏃">Correr</Chip>
 *   <Chip icon={Plus} onClick={addCustom}>Otro</Chip>
 *   <Tag tone="done" icon={Check}>Lograda</Tag>
 *   <Tag tone="member" userId="user4">Fran</Tag>
 *   <Tag>Privado</Tag>
 *
 * Chip: selected, emoji (contenido), icon (lucide), size 'sm'|'md' (36 / 44 px).
 * Tag tone: 'neutral' | 'ink' | 'done' | 'member' | 'outline'.
 */
export function Chip({ selected = false, emoji, icon: Icon, size = 'md', className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-[15px]',
        selected
          ? 'border-ink bg-ink text-on-ink'
          : 'border-line-strong bg-surface text-ink hover:border-ink-faint',
        className
      )}
      {...rest}
    >
      {emoji && (
        <span aria-hidden="true" className="text-base leading-none">
          {emoji}
        </span>
      )}
      {Icon && <Icon size={16} strokeWidth={2.4} aria-hidden="true" />}
      {children}
    </button>
  )
}

const TAG_TONES = {
  neutral: 'bg-surface-sunk text-ink-soft',
  ink: 'bg-ink text-on-ink',
  done: 'bg-done-soft text-done-ink',
  member: 'bg-member-tint text-member-ink',
  outline: 'border border-line-strong text-ink-soft',
}

export function Tag({ tone = 'neutral', icon: Icon, userId, className, children, ...rest }) {
  return (
    <span
      {...memberProps(userId)}
      className={cx(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        TAG_TONES[tone] || TAG_TONES.neutral,
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={13} strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </span>
  )
}

export default Chip

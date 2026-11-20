/**
 * Piezas chicas del álbum que comparten la página, la hoja de detalle y la vista familiar.
 */
import { Avatar, RARITY_LABEL, cx, memberProps } from '../../components/ui'

export const RARITY_IDS = ['comun', 'rara', 'epica', 'legendaria']
export const RARITY_PLURAL = { comun: 'Comunes', rara: 'Raras', epica: 'Épicas', legendaria: 'Legendarias' }

/** Muestra de color de una rareza: un mini troquel con su borde blanco. */
export function RaritySwatch({ rarity, size = 16, className }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: `var(--rar-${rarity})`,
        boxShadow: `0 0 0 2px var(--sticker-edge), var(--shadow-sticker)`,
      }}
    />
  )
}

/** Etiqueta de rareza: muestra + nombre en la tinta de la rareza. */
export function RarityTag({ rarity, className }) {
  return (
    <span className={cx('inline-flex items-center gap-2 type-small font-semibold', className)} style={{ color: `var(--rar-${rarity}-ink)` }}>
      <RaritySwatch rarity={rarity} size={12} />
      {RARITY_LABEL[rarity]}
    </span>
  )
}

/**
 * Selector de persona: las cuatro caras. El álbum elegido lleva el anillo de su color.
 * @param {{id,name,avatar}[]} members
 */
export function MemberSwitcher({ members, value, onChange, currentUserId, label = 'Ver el álbum de' }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1">
      {members.map((m, i) => {
        const active = m.id === value
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
              if (!dir) return
              e.preventDefault()
              const nextM = members[(i + dir + members.length) % members.length]
              onChange(nextM.id)
              e.currentTarget.parentElement?.querySelectorAll('button')[(i + dir + members.length) % members.length]?.focus()
            }}
            {...memberProps(m.id)}
            className="flex min-h-11 min-w-16 flex-col items-center gap-1.5 rounded-control px-1 py-1.5"
          >
            <span
              aria-hidden="true"
              className={cx(
                'flex rounded-full transition-[box-shadow,opacity] duration-200',
                active ? 'opacity-100' : 'opacity-60 hover:opacity-90'
              )}
              style={{ boxShadow: active ? '0 0 0 2.5px var(--paper), 0 0 0 5px var(--member)' : 'none' }}
            >
              <Avatar userId={m.id} src={m.avatar} name="" size={44} />
            </span>
            <span className={cx('type-caption', active ? 'font-bold text-member-ink' : 'text-ink-soft')}>
              {m.id === currentUserId ? 'Tú' : m.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

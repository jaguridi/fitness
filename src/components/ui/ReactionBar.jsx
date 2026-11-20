import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { cx } from './cx'
import { memberName } from './MemberName'

/**
 * ReactionBar — reacciones de la familia a una publicación (presentacional).
 * Una reacción por persona; tocar la tuya de nuevo la quita.
 *
 *   <ReactionBar reactions={post.reactions} members={members} currentUserId={me.id}
 *                onReact={(emoji) => actions.react(post.id, emoji)} />   // emoji = null para quitar
 *
 * @param {Record<string,string>} reactions { [userId]: emoji }
 * @param {{id,name}[]} members
 * @param {string} currentUserId
 * @param {(emoji:string|null)=>void} onReact
 * @param {string[]} [palette] emojis disponibles
 */
export const REACTION_PALETTE = ['💪', '🔥', '👏', '❤️', '😂', '🤯']

export default function ReactionBar({
  reactions = {},
  members,
  currentUserId,
  onReact,
  palette = REACTION_PALETTE,
  className,
}) {
  const [picking, setPicking] = useState(false)
  const mine = reactions[currentUserId] || null

  const groups = []
  for (const [uid, emoji] of Object.entries(reactions)) {
    if (!emoji) continue
    let g = groups.find((x) => x.emoji === emoji)
    if (!g) groups.push((g = { emoji, users: [] }))
    g.users.push(uid)
  }

  const choose = (emoji) => {
    setPicking(false)
    onReact?.(emoji === mine ? null : emoji)
  }

  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {!picking &&
        groups.map((g) => {
          const isMine = g.emoji === mine
          const names = g.users.map((u) => (u === currentUserId ? 'tú' : memberName(u, members))).join(', ')
          return (
            <button
              key={g.emoji}
              type="button"
              onClick={() => choose(g.emoji)}
              aria-pressed={isMine}
              aria-label={`${g.emoji} de ${names}${isMine ? '. Toca para quitar la tuya' : ''}`}
              title={names}
              className={cx(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums transition-[background-color,border-color,transform] duration-150 active:scale-95',
                isMine ? 'border-ink bg-ink/6 text-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong'
              )}
            >
              <span key={isMine ? 'm' : 'o'} className={cx('text-base leading-none', isMine && 'animate-pop')}>
                {g.emoji}
              </span>
              {g.users.length}
            </button>
          )
        })}
      {picking && (
        <div role="group" aria-label="Elige una reacción" className="flex animate-fade-in items-center gap-0.5 rounded-full border border-line bg-surface p-0.5">
          {palette.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => choose(e)}
              aria-label={`Reaccionar con ${e}`}
              aria-pressed={e === mine}
              className={cx(
                'inline-flex size-10 items-center justify-center rounded-full text-xl leading-none transition-transform duration-150 hover:scale-110 active:scale-95',
                e === mine && 'bg-ink/8'
              )}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setPicking((p) => !p)}
        aria-expanded={picking}
        aria-label={picking ? 'Cerrar reacciones' : 'Reaccionar'}
        title="Reaccionar"
        className="inline-flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/6 hover:text-ink"
      >
        <SmilePlus size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  )
}

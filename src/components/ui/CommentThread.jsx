import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import Avatar from './Avatar'
import { cx } from './cx'
import { findMember } from './MemberName'
import { memberProps } from './member'
import { timeAgo } from './time'

/**
 * CommentThread — comentarios de una publicación + caja para escribir (presentacional).
 *
 *   <CommentThread comments={post.comments} members={members} currentUserId={me.id}
 *                  onComment={(text) => actions.comment(post.id, text)} />
 *
 * @param {{userId:string,text:string,createdAt:any}[]} comments en orden cronológico
 * @param {{id,name,avatar}[]} members
 * @param {string} currentUserId
 * @param {(text:string)=>Promise|void} onComment  si falta, no se muestra la caja
 * @param {number} [collapseAfter=3] muestra los últimos N y un botón "Ver los X comentarios"
 * @param {string} [placeholder='Escribe un comentario']
 */
export default function CommentThread({
  comments = [],
  members,
  currentUserId,
  onComment,
  collapseAfter = 3,
  placeholder = 'Escribe un comentario',
  className,
}) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const hidden = expanded ? 0 : Math.max(0, comments.length - collapseAfter)
  const visible = comments.slice(hidden)

  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await onComment?.(t)
      setText('')
    } finally {
      setSending(false)
    }
  }

  const me = findMember(currentUserId, members)

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="type-small -my-2 self-start py-2 font-semibold text-ink-soft hover:text-ink"
        >
          Ver los {comments.length} comentarios
        </button>
      )}
      {visible.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visible.map((c, i) => {
            const m = findMember(c.userId, members)
            return (
              <li key={`${c.userId}-${hidden + i}`} className="flex gap-2.5">
                <Avatar userId={c.userId} src={m?.avatar} name={m?.name} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="type-small text-ink">
                    <span {...memberProps(c.userId)} className="mr-1.5 font-bold text-member-ink">
                      {c.userId === currentUserId ? 'Tú' : m?.name || 'Alguien'}
                    </span>
                    <span className="break-words">{c.text}</span>
                  </p>
                  {c.createdAt && <p className="type-caption mt-0.5 font-medium text-ink-faint">{timeAgo(c.createdAt)}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {onComment && (
        <form onSubmit={submit} className="flex items-center gap-2">
          {me && <Avatar userId={me.id} src={me.avatar} name={me.name} size="xs" />}
          <label className="sr-only" htmlFor={`comment-${currentUserId}`}>
            Comentario
          </label>
          <input
            id={`comment-${currentUserId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            enterKeyHint="send"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-sunk px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink focus:bg-surface focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Enviar comentario"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-30"
          >
            <SendHorizontal size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  )
}

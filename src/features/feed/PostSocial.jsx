import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SendHorizontal } from 'lucide-react'
import { Avatar, CommentThread, ReactionBar, cx, findMember } from '../../components/ui'
import { useFamily } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { COMMENT_MAX, reactorsLine } from './feedUtils'

/**
 * Reactions + comments of one feed post, optimistic: the tap shows at once and
 * reverts with a toast if the write fails.
 *
 *   <PostSocial target={item.target} doc={item.data} />
 *
 * @param {{ kind, id }} target   reaction/comment target (buildFeed item.target)
 * @param {{ reactions?, comments? }} doc  the doc behind the target
 * @param {number} [collapseAfter=2]
 */
export default function PostSocial({ target, doc, collapseAfter = 2, className }) {
  const { members, actions } = useFamily()
  const { currentUser } = useAuth()
  const me = currentUser?.id
  // undefined = no pending change; null = removing mine; string = my new emoji
  const [pendingReaction, setPendingReaction] = useState(undefined)
  const [pendingComments, setPendingComments] = useState([])

  const reactions = useMemo(() => {
    const base = { ...(doc?.reactions || {}) }
    if (pendingReaction === undefined) return base
    if (pendingReaction) base[me] = pendingReaction
    else delete base[me]
    return base
  }, [doc?.reactions, pendingReaction, me])

  const comments = useMemo(() => [...(doc?.comments || []), ...pendingComments], [doc?.comments, pendingComments])

  const react = async (emoji) => {
    setPendingReaction(emoji)
    try {
      await actions.react(target, emoji)
    } catch (err) {
      console.error('react failed:', err)
      toast.error('No se pudo guardar tu reacción. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setPendingReaction(undefined)
    }
  }

  const comment = async (text) => {
    const optimistic = { userId: me, text, createdAt: Date.now(), _pending: true }
    setPendingComments((p) => [...p, optimistic])
    try {
      await actions.comment(target, text)
      return true
    } catch (err) {
      console.error('comment failed:', err)
      toast.error('No se pudo publicar tu comentario. Inténtalo de nuevo.')
      return false
    } finally {
      setPendingComments((p) => p.filter((c) => c !== optimistic))
    }
  }

  const who = reactorsLine(reactions, members, me)

  return (
    <div className={cx('flex flex-col', className)}>
      <div className="px-3 pt-2">
        <ReactionBar reactions={reactions} members={members} currentUserId={me} onReact={react} />
        {who && <p className="type-caption px-1 pb-1 text-ink-soft">{who}</p>}
      </div>
      <div className="mt-2 flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4">
        {comments.length > 0 && (
          <CommentThread comments={comments} members={members} currentUserId={me} collapseAfter={collapseAfter} />
        )}
        <CommentComposer me={me} members={members} onSend={comment} />
      </div>
    </div>
  )
}

/** Comment box: 140 characters, Enter or the button sends. Clears at once; restores the text on failure. */
function CommentComposer({ me, members, onSend }) {
  const id = useId()
  const [text, setText] = useState('')
  const self = findMember(me, members)
  const left = COMMENT_MAX - text.length

  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    const ok = await onSend(t)
    if (!ok) setText((cur) => cur || t)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      {self && <Avatar userId={self.id} src={self.avatar} name={self.name} size="xs" />}
      <label className="sr-only" htmlFor={id}>
        Comentario
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
          placeholder="Escribe un comentario"
          maxLength={COMMENT_MAX}
          enterKeyHint="send"
          autoComplete="off"
          className={cx(
            'h-11 w-full rounded-full border border-line bg-surface-sunk px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink focus:bg-surface focus:outline-none',
            left <= 20 && 'pr-12'
          )}
        />
        {left <= 20 && (
          <span
            aria-live="polite"
            className={cx('type-caption absolute top-1/2 right-4 -translate-y-1/2 tabular-nums', left <= 5 ? 'font-bold text-ink' : 'text-ink-soft')}
          >
            {left}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label="Enviar comentario"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-30"
      >
        <SendHorizontal size={18} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </form>
  )
}

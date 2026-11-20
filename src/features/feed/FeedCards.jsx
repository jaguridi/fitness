import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Check, Flag, ImageOff, Moon, Pencil, Trophy } from 'lucide-react'
import {
  Avatar,
  GoalProgress,
  IconButton,
  MemberName,
  PhotoViewer,
  RARITY_LABEL,
  Sticker,
  Surface,
  Tag,
  cx,
  findMember,
  memberProps,
} from '../../components/ui'
import { useFamily } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { getMemberWeek } from '../../data/selectors'
import { timeAgo } from '../../utils/dates'
import PostSocial from './PostSocial'
import WorkoutEditSheet from './WorkoutEditSheet'
import {
  canEditWorkout,
  goalUnit,
  sessionLabel,
  sessionOrdinals,
  sortWeekResults,
  trainedOnHint,
  weekHeadline,
  weekRangeLabel,
  workoutMeta,
  workoutTitle,
} from './feedUtils'

/** One card per feed item kind. `item` is a buildFeed() item. */
export default function FeedCard({ item }) {
  switch (item.kind) {
    case 'workout':
      return <WorkoutCard workout={item.data} target={item.target} />
    case 'unlock':
      return <UnlockCard item={item} />
    case 'weekPost':
      return <WeekPostCard item={item} />
    case 'goalCreated':
    case 'goalAchieved':
      return <GoalCard item={item} />
    default:
      return null
  }
}

// ── Shared bits ─────────────────────────────────────────────

/** Avatar + name (both lead to the member's profile) + a time line. */
function PostAuthor({ userId, time, children }) {
  const { members } = useFamily()
  const { currentUser } = useAuth()
  const m = findMember(userId, members)
  return (
    <Link
      to={`/u/${userId}`}
      className="-m-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control p-1 hover:bg-ink/4"
    >
      <Avatar userId={userId} src={m?.avatar} name="" size="sm" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="type-body block truncate">
          <MemberName userId={userId} members={members} you currentUserId={currentUser?.id} className="font-bold" />
          {children}
        </span>
        {time && <span className="type-caption block text-ink-soft">{time}</span>}
      </span>
    </Link>
  )
}

const ordinalCache = new WeakMap()
function ordinalsFor(workouts) {
  let m = ordinalCache.get(workouts)
  if (!m) {
    m = sessionOrdinals(workouts)
    ordinalCache.set(workouts, m)
  }
  return m
}

/** "2.ª de 3" for a workout, from the whole store (null when not derivable). */
function useSessionLabel(workout) {
  const { state } = useFamily()
  const ordinal = ordinalsFor(state.workouts).get(workout.id)
  if (!ordinal || !workout.weekId) return null
  const week = getMemberWeek(state, workout.userId, workout.weekId)
  return sessionLabel(ordinal, week?.goal)
}

// ── Workout ─────────────────────────────────────────────────

/**
 * A workout post: who, when, which session of the week, what, the photo and
 * the social row. Also used inside the member page's workout sheet.
 */
export function WorkoutCard({ workout, target = { kind: 'workout', id: workout.id }, social = true, className }) {
  const { members } = useFamily()
  const { currentUser } = useAuth()
  const [viewing, setViewing] = useState(false)
  const [editing, setEditing] = useState(false)
  const session = useSessionLabel(workout)
  const editable = canEditWorkout(workout, currentUser?.id)
  const title = workoutTitle(workout)
  const meta = workoutMeta(workout)
  const hint = trainedOnHint(workout)
  const time = [timeAgo(workout.createdAt ?? (workout.date ? `${workout.date}T12:00:00` : null)), hint].filter(Boolean).join(', ')
  const name = findMember(workout.userId, members)?.name || 'Alguien'

  return (
    <Surface as="article" padding="none" className={cx('overflow-hidden', className)} aria-label={`${name}: ${title}`}>
      <div className="flex items-center gap-2 px-4 pt-4">
        <PostAuthor userId={workout.userId} time={time} />
        {session && (
          <Tag tone={session.tone} userId={workout.userId} icon={session.tone === 'done' ? Check : undefined} className="shrink-0">
            {session.label}
          </Tag>
        )}
        {editable && <IconButton icon={Pencil} label="Editar ejercicio" onClick={() => setEditing(true)} className="-mr-2" />}
      </div>
      <div className="px-4 pt-3">
        <p className="type-sub text-ink">{title}</p>
        {meta && <p className="type-small mt-0.5 tabular-nums text-ink-soft">{meta}</p>}
        {workout.description && <p className="type-body mt-2 break-words whitespace-pre-line text-ink">{workout.description}</p>}
      </div>
      {workout.photoURL && (
        <FeedPhoto src={workout.photoURL} alt={`Foto de ${name}: ${title}`} onOpen={() => setViewing(true)} className="mx-4 mt-3" />
      )}
      {social && <PostSocial target={target} doc={workout} />}
      {!social && <div className="h-4" />}
      <PhotoViewer
        open={viewing}
        onClose={() => setViewing(false)}
        src={workout.photoURL}
        alt={`Foto de ${name}: ${title}`}
        caption={[name, [title, meta].filter(Boolean).join(', ')].join(': ')}
      />
      {editable && <WorkoutEditSheet workout={workout} open={editing} onClose={() => setEditing(false)} />}
    </Surface>
  )
}

/** The workout photo: lazy, fixed 4:3 box (no jumps), tolerant to broken URLs. */
export function FeedPhoto({ src, alt, onOpen, className }) {
  const [state, setState] = useState('loading') // loading | ok | error
  if (state === 'error') {
    return (
      <div
        className={cx(
          'flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[14px] bg-surface-sunk text-ink-soft',
          className
        )}
      >
        <ImageOff size={24} strokeWidth={2} aria-hidden="true" />
        <span className="type-small">No se pudo cargar la foto</span>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ver la foto en grande"
      className={cx('block aspect-[4/3] w-[calc(100%-2rem)] overflow-hidden rounded-[14px] bg-surface-sunk', className)}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        className={cx('h-full w-full object-cover transition-opacity duration-300', state === 'ok' ? 'opacity-100' : 'opacity-0')}
      />
    </button>
  )
}

// ── Sticker unlock ──────────────────────────────────────────

function UnlockCard({ item }) {
  const u = item.data
  const a = u.achievement || {}
  const rarity = a.rarity || u.rarity || 'comun'
  const name = a.name || u.name || 'Una lámina nueva'
  return (
    <Surface as="article" variant="tint" padding="none" {...memberProps(u.userId)} className="overflow-hidden">
      <div className="px-4 pt-4">
        <PostAuthor userId={u.userId} time={timeAgo(item.ts)}>
          <span className="font-normal text-ink">{item.isMine ? ' ganaste una lámina' : ' ganó una lámina'}</span>
        </PostAuthor>
      </div>
      <div className="flex items-center gap-4 px-4 pt-4 pb-2">
        <Sticker
          id={u.achievementId || a.id || u.id}
          icon={a.icon || u.icon}
          number={a.number ?? u.number}
          rarity={rarity}
          earned
          size="sm"
          showLabel={false}
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="type-sub text-ink">{name}</p>
          {(a.description || u.description) && <p className="type-small mt-0.5 text-ink-soft">{a.description || u.description}</p>}
          <p className="type-caption mt-1 font-semibold" style={{ color: `var(--rar-${rarity}-ink)` }}>
            {RARITY_LABEL[rarity] || 'Común'}
          </p>
        </div>
      </div>
      <PostSocial target={item.target} doc={u} />
    </Surface>
  )
}

// ── Weekly result ───────────────────────────────────────────

function WeekPostCard({ item }) {
  const p = item.data
  const { members } = useFamily()
  const { currentUser } = useAuth()
  const results = sortWeekResults(p.results)
  const headline = weekHeadline(results, (id) => findMember(id, members)?.name || 'Alguien')

  return (
    <Surface as="article" padding="none" className="overflow-hidden" aria-label="Resultado de la semana">
      <div className="px-5 pt-5">
        <p className="type-small flex items-center gap-1.5 font-semibold text-ink-soft">
          <CalendarCheck size={16} strokeWidth={2.3} aria-hidden="true" />
          Resultado de la semana
        </p>
        <p className="type-heading mt-1 text-ink">{headline}</p>
        <p className="type-small mt-0.5 text-ink-soft">{weekRangeLabel(p.weekId || p.id)}</p>
        <ul className="mt-4 flex flex-col gap-1">
          {results.map((r) => (
            <WeekResultRow key={r.userId} r={r} members={members} me={currentUser?.id} />
          ))}
        </ul>
        {p.recap && <p className="type-body mt-4 border-t border-line pt-4 whitespace-pre-line text-ink">{p.recap}</p>}
      </div>
      <PostSocial target={item.target} doc={p} className="mt-3" />
    </Surface>
  )
}

function WeekResultRow({ r, members, me }) {
  const m = findMember(r.userId, members)
  const achieved = r.status === 'completed' || r.status === 'lifeUsed'
  const rest = r.status === 'rest'
  const parts = []
  if (rest) parts.push('Semana de descanso')
  else parts.push(`${r.sessions ?? 0} de ${r.goal ?? 0} ${(r.goal ?? 0) === 1 ? 'sesión' : 'sesiones'}`)
  if (r.habitsTotal > 0) parts.push(`${r.habitsMet ?? 0} de ${r.habitsTotal} ${r.habitsTotal === 1 ? 'hábito' : 'hábitos'}`)
  if (r.streak > 0) parts.push(`racha de ${r.streak}`)
  return (
    <li>
      <Link to={`/u/${r.userId}`} className="-mx-2 flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 hover:bg-ink/4">
        <Avatar userId={r.userId} src={m?.avatar} name="" size="sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <MemberName userId={r.userId} members={members} you currentUserId={me} className="type-small block font-bold" />
          <span className="type-caption block tabular-nums text-ink-soft">{parts.join(', ')}</span>
        </span>
        {achieved && (
          <Tag tone="done" icon={Check}>
            Lograda
          </Tag>
        )}
        {rest && <Tag icon={Moon}>Descanso</Tag>}
        {!achieved && !rest && <Tag tone="outline">No salió</Tag>}
      </Link>
    </li>
  )
}

// ── Personal goals ──────────────────────────────────────────

function GoalCard({ item }) {
  const view = item.data
  const g = view.goal
  const achievedPost = item.kind === 'goalAchieved'
  const reward = g.reward?.trim()
  return (
    <Surface as="article" padding="none" className="overflow-hidden" {...memberProps(g.userId)}>
      <div className={cx('px-4 pt-4 pb-1', achievedPost && 'bg-done-soft pb-4')}>
        <PostAuthor userId={g.userId} time={timeAgo(item.ts)}>
          <span className="font-normal text-ink">
            {achievedPost ? (item.isMine ? ' lograste tu meta' : ' logró su meta') : item.isMine ? ' te propusiste una meta' : ' se propuso una meta'}
          </span>
        </PostAuthor>
        {achievedPost && reward && (
          <p className="type-body mt-3 flex items-start gap-2 font-semibold text-done-ink">
            <Trophy size={18} strokeWidth={2.3} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {item.isMine ? 'Y te ganaste: ' : 'Y se ganó: '}
              {reward}
            </span>
          </p>
        )}
        {!achievedPost && view.state === 'active' && g.endDate && (
          <p className="type-small mt-2 flex items-center gap-1.5 text-ink-soft">
            <Flag size={15} strokeWidth={2.3} aria-hidden="true" />
            Hasta el {formatEnd(g.endDate)}
          </p>
        )}
      </div>
      <div className="px-4 pt-3">
        <GoalProgress
          userId={g.userId}
          emoji={g.emoji}
          title={g.title}
          current={view.progress?.current ?? 0}
          target={view.progress?.target ?? g.target}
          unit={goalUnit(g)}
          daysLeft={view.daysLeft}
          reward={achievedPost ? undefined : reward}
          status={view.state}
          own={item.isMine}
        />
      </div>
      <PostSocial target={item.target} doc={g} className="mt-2" />
    </Surface>
  )
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function formatEnd(ymd) {
  if (!ymd) return ''
  const [, m, d] = ymd.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
}

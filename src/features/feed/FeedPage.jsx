import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Avatar, Button, EmptyState, PageHeader, Skeleton, SkeletonText, Surface, cx, memberProps } from '../../components/ui'
import { useFamily, useFeed } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { useLogSheet } from '../log/LogSheetContext'
import FeedCard from './FeedCards'
import { dayLabel, groupByDay } from './feedUtils'

const PAGE = 15

/** Familia — the family timeline: workouts, new stickers, weekly results and goals. */
export default function FeedPage() {
  const { ready, members } = useFamily()
  const { currentUser } = useAuth()
  const [filter, setFilter] = useState(null) // null = everyone
  const [limit, setLimit] = useState(PAGE)
  // one extra item tells whether there is more to load
  const feed = useFeed({ limit: limit + 1, userId: filter || undefined })
  const visible = feed.slice(0, limit)
  const hasMore = feed.length > limit
  const groups = groupByDay(visible)
  const now = Date.now()

  const choose = (id) => {
    setFilter(id)
    setLimit(PAGE)
  }

  const filtered = filter ? members.find((m) => m.id === filter) : null

  return (
    <>
      <PageHeader title="Familia" description="Lo que la familia anda haciendo." className="pb-4" />
      <MemberFilter members={members} value={filter} onChange={choose} me={currentUser?.id} />

      {!ready ? (
        <FeedSkeleton />
      ) : visible.length === 0 ? (
        <FeedEmpty member={filtered} isMe={filtered?.id === currentUser?.id} />
      ) : (
        <div className="mt-2">
          {groups.map((g) => (
            <section key={g.day} aria-label={dayLabel(g.ts, now)} className="mt-6 first:mt-4">
              <h2 className="type-small mb-3 font-bold text-ink-soft">{dayLabel(g.ts, now)}</h2>
              <ul className="flex flex-col gap-4">
                {g.items.map((item) => (
                  <li key={item.key}>
                    <FeedCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="mt-6 flex justify-center">
            {hasMore ? (
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Ver más publicaciones
              </Button>
            ) : (
              <p className="type-small py-2 text-ink-faint">
                {filtered ? `Eso es todo lo de ${filtered.name}.` : 'Llegaste al comienzo de la historia.'}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** "Todos" + the four avatars in their colors. */
function MemberFilter({ members, value, onChange, me }) {
  return (
    <div role="group" aria-label="Filtrar por persona" className="-mx-1 flex items-start justify-between gap-1">
      <FilterButton selected={!value} onClick={() => onChange(null)} label="Todos">
        <span
          className={cx(
            'inline-flex size-11 items-center justify-center rounded-full transition-colors',
            !value ? 'bg-ink text-on-ink' : 'bg-surface-sunk text-ink-soft'
          )}
        >
          <Users size={20} strokeWidth={2.3} aria-hidden="true" />
        </span>
      </FilterButton>
      {members.map((m) => (
        <FilterButton
          key={m.id}
          userId={m.id}
          selected={value === m.id}
          onClick={() => onChange(value === m.id ? null : m.id)}
          label={m.id === me ? 'Tú' : m.name}
        >
          <Avatar userId={m.id} src={m.avatar} name="" size={44} />
        </FilterButton>
      ))}
    </div>
  )
}

function FilterButton({ selected, onClick, label, userId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      {...memberProps(userId)}
      className="flex min-w-14 flex-1 flex-col items-center gap-1.5 rounded-control py-1"
    >
      <span
        className={cx(
          'flex rounded-full p-[3px] transition-[box-shadow] duration-150',
          selected ? 'shadow-[0_0_0_2.5px_var(--member)]' : 'shadow-[0_0_0_1px_transparent]'
        )}
      >
        {children}
      </span>
      <span className={cx('type-caption', selected ? 'font-bold text-member-ink' : 'font-medium text-ink-soft')}>{label}</span>
    </button>
  )
}

function FeedEmpty({ member, isMe }) {
  const { openLog } = useLogSheet()
  if (member && !isMe) {
    return (
      <EmptyState
        className="mt-6"
        icon={Users}
        title={`${member.name} aún no publica nada`}
        description="Cuando registre un ejercicio, gane una lámina o se proponga una meta, aparecerá aquí."
      />
    )
  }
  return (
    <EmptyState
      className="mt-6"
      icon={Users}
      title={isMe ? 'Aún no publicas nada' : 'La familia está por empezar'}
      description="Registra un ejercicio con su foto y la familia podrá reaccionar y comentarlo."
      action={
        <Button icon={Plus} onClick={() => openLog()}>
          Registrar ejercicio
        </Button>
      }
    />
  )
}

function FeedSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4" aria-busy="true" aria-label="Cargando publicaciones">
      <Skeleton className="h-3.5 w-16" />
      {[0, 1].map((i) => (
        <Surface key={i}>
          <div className="flex items-center gap-3">
            <Skeleton shape="circle" className="size-9" />
            <div className="flex-1">
              <Skeleton className="w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/5" />
            </div>
          </div>
          <SkeletonText lines={2} className="mt-4" />
          <Skeleton shape="surface" className="mt-4 aspect-[4/3] h-auto rounded-[14px]" />
        </Surface>
      ))}
    </div>
  )
}

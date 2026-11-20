import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Hand, Lock, Settings, Target, UserRoundX } from 'lucide-react'
import {
  AvatarRing,
  Button,
  EmptyState,
  GoalProgress,
  HabitDots,
  IconButton,
  ProgressBar,
  Section,
  Sheet,
  Sticker,
  Surface,
  Tag,
  WeekStrip,
  memberProps,
} from '../../components/ui'
import {
  useAchievements,
  useAlbumSummary,
  useFamily,
  useGoals,
  useHabitProgress,
  useMemberStats,
  useMemberWeek,
} from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { weekdayIndex } from '../../game/habits'
import { WorkoutCard } from '../feed/FeedCards'
import { goalUnit, workoutMeta, workoutTitle } from '../feed/feedUtils'
import MonthCalendar from './MonthCalendar'
import { dayCounts, fmtNumber, formatTotalMinutes, isBehind, longDate, statusLine, stickerShowcase } from './memberUtils'

const ROWS_PAGE = 10

/** Perfil público de un miembro (también el tuyo): su semana, hábitos, metas, álbum y ejercicios. */
export default function MemberPage() {
  const { userId } = useParams()
  const { members } = useFamily()
  const member = members.find((m) => m.id === userId)
  if (!member) return <MemberNotFound />
  return <MemberProfile key={member.id} member={member} />
}

function MemberNotFound() {
  const navigate = useNavigate()
  return (
    <div className="pt-10">
      <EmptyState
        icon={UserRoundX}
        title="No encontramos a esa persona"
        description="El enlace puede estar incompleto. La familia está en la pestaña Familia."
        action={
          <Button onClick={() => navigate('/familia')}>Ir a Familia</Button>
        }
      />
    </div>
  )
}

function MemberProfile({ member }) {
  const { today, workouts } = useFamily()
  const { currentUser } = useAuth()
  const isMe = currentUser?.id === member.id
  const week = useMemberWeek(member.id)
  const [sheet, setSheet] = useState(null) // { title, ids }

  const mine = useMemo(() => workouts.filter((w) => w.userId === member.id), [workouts, member.id])
  const openWorkouts = (title, list) => setSheet({ title, ids: list.map((w) => w.id) })
  const sheetWorkouts = sheet ? mine.filter((w) => sheet.ids.includes(w.id)) : []

  return (
    <div {...memberProps(member.id)}>
      <ProfileHeader member={member} week={week} isMe={isMe} />

      <Section title="Esta semana" className="mt-8">
        <WeekStrip
          userId={member.id}
          days={dayCounts(week.workouts)}
          today={weekdayIndex(today)}
          onDayClick={(i) => {
            const list = week.workouts.filter((w) => weekdayIndex(w.date) === i)
            if (list.length) openWorkouts(longDate(list[0].date), list)
          }}
        />
        <HabitList userId={member.id} isMe={isMe} />
      </Section>

      <GoalsSection userId={member.id} isMe={isMe} name={member.name} />
      <AlbumPeek userId={member.id} isMe={isMe} name={member.name} />
      <StatsSection userId={member.id} />

      <Section title="Calendario">
        <MonthCalendar
          userId={member.id}
          workouts={mine}
          today={today}
          onOpenDay={(d) => openWorkouts(longDate(d), mine.filter((w) => w.date === d))}
        />
      </Section>

      <WorkoutRows
        workouts={mine}
        isMe={isMe}
        name={member.name}
        onOpen={(w) => openWorkouts(longDate(w.date), [w])}
      />

      <Sheet open={!!sheet && sheetWorkouts.length > 0} onClose={() => setSheet(null)} title={sheet?.title ? cap(sheet.title) : ''}>
        <div className="flex flex-col gap-4">
          {sheetWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      </Sheet>
    </div>
  )
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// ── Header ──────────────────────────────────────────────────

function ProfileHeader({ member, week, isMe }) {
  const navigate = useNavigate()
  return (
    <header className="-mx-4 bg-member-tint px-4 pt-2 pb-6 sm:mx-0 sm:mt-4 sm:rounded-surface sm:px-5" style={{ '--ring-bg': 'var(--member-tint)' }}>
      <div className="-mx-2 flex h-11 items-center justify-between">
        <IconButton icon={ChevronLeft} label="Volver" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/familia'))} />
        {isMe && (
          <Link
            to="/perfil"
            className="type-small inline-flex h-11 items-center gap-1.5 rounded-full px-3 font-semibold text-ink hover:bg-ink/6"
          >
            <Settings size={18} strokeWidth={2.2} aria-hidden="true" />
            Ajustes de tu perfil
          </Link>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <AvatarRing
          userId={member.id}
          src={week.avatar || member.avatar}
          name={member.name}
          segments={week.goal}
          filled={week.sessions}
          rest={week.rest}
          size="xl"
        />
        <div className="min-w-0">
          <h1 className="type-title truncate text-ink">{member.name}</h1>
          {isMe && <p className="type-small font-semibold text-member-ink">Así te ve la familia</p>}
        </div>
      </div>
      <p className="type-body mt-4 font-semibold text-ink">{statusLine(week, { isMe })}</p>
      <ul className="type-small mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
        <li className="flex items-center gap-1.5">
          <Flame size={16} strokeWidth={2.3} className="text-member-ink" aria-hidden="true" />
          {week.streak > 0 ? `Racha de ${week.streak} ${week.streak === 1 ? 'semana' : 'semanas'}` : 'Sin racha por ahora'}
        </li>
        <li className="flex items-center gap-1.5">
          <Target size={16} strokeWidth={2.3} className="text-member-ink" aria-hidden="true" />
          Meta de {week.goal} {week.goal === 1 ? 'sesión' : 'sesiones'} por semana
        </li>
      </ul>
      {!isMe && isBehind(week) && <NudgeButton member={member} />}
    </header>
  )
}

function NudgeButton({ member }) {
  const { actions } = useFamily()
  const [sending, setSending] = useState(false)
  const [, force] = useState(0)
  const cooldown = actions.nudgeCooldownMinutes(member.id)

  const send = async () => {
    setSending(true)
    try {
      await actions.sendNudge(member.id)
      toast.success(`Le enviaste un empujón a ${member.name}`, { description: 'Le llegará una notificación.' })
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el empujón. Inténtalo de nuevo.')
    } finally {
      setSending(false)
      force((n) => n + 1)
    }
  }

  return (
    <div className="mt-5">
      <Button variant="member" icon={Hand} onClick={send} loading={sending} disabled={cooldown > 0}>
        Dar un empujón
      </Button>
      {cooldown > 0 && (
        <p className="type-small mt-2 text-ink-soft">
          Ya le diste un empujón. Puedes darle otro en {cooldown} min.
        </p>
      )}
    </div>
  )
}

// ── Habits ──────────────────────────────────────────────────

function HabitList({ userId, isMe }) {
  const { today, weekId } = useFamily()
  const habits = useHabitProgress(userId, { weekId })
  const todayIdx = weekdayIndex(today)
  if (!habits.length) {
    return isMe ? (
      <p className="type-small mt-5 text-ink-soft">
        Aún no tienes hábitos.{' '}
        <Link to="/habitos" className="font-semibold text-ink underline underline-offset-2">
          Crea el primero
        </Link>
      </p>
    ) : null
  }
  return (
    <ul className="mt-5 flex flex-col">
      {habits.map((h) => (
        <li key={h.habitId} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
          <span aria-hidden="true" className="text-xl leading-none">
            {h.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-body flex items-center gap-2 font-semibold text-ink">
              <span className="truncate">{h.name}</span>
              {h.visibility === 'private' && (
                <Tag icon={Lock} className="shrink-0">
                  Privado
                </Tag>
              )}
            </span>
            <HabitDots checks={h.days} target={h.target} today={todayIdx} userId={userId} habitName={h.name} className="mt-1.5" />
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Goals ───────────────────────────────────────────────────

function GoalsSection({ userId, isMe, name }) {
  const goals = useGoals(userId).filter((g) => g.state === 'active')
  if (!goals.length && !isMe) return null
  return (
    <Section
      title={isMe ? 'Tus metas' : `Metas de ${name}`}
      action={
        isMe && goals.length > 0 ? (
          <Link to="/metas" className="type-small inline-flex h-11 items-center px-2 font-semibold text-ink hover:underline">
            Ver todas
          </Link>
        ) : null
      }
    >
      {goals.length ? (
        <ul className="flex flex-col gap-4">
          {goals.map((v) => (
            <li key={v.id}>
              <GoalProgress
                userId={userId}
                emoji={v.goal.emoji}
                title={v.goal.title}
                current={v.progress.current}
                target={v.progress.target}
                unit={goalUnit(v.goal)}
                daysLeft={v.daysLeft}
                reward={v.goal.reward}
                status={v.state}
                own={isMe}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={Target}
          title="Sin metas activas"
          description="Ponte una meta con plazo y, si quieres, una recompensa."
          action={
            <Link to="/metas" className="type-small inline-flex h-11 items-center font-semibold text-ink underline underline-offset-2">
              Proponerte una meta
            </Link>
          }
        />
      )}
    </Section>
  )
}

// ── Album ───────────────────────────────────────────────────

function AlbumPeek({ userId, isMe, name }) {
  const album = useAlbumSummary(userId)
  const achievements = useAchievements(userId)
  const show = stickerShowcase(achievements, 3)
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-body text-ink">
          <span className="font-bold tabular-nums">{album.earned}</span> de <span className="tabular-nums">{album.total}</span> láminas
        </p>
        {isMe && <ChevronRight size={20} strokeWidth={2.2} className="shrink-0 text-ink-soft" aria-hidden="true" />}
      </div>
      <ProgressBar value={album.earned} max={album.total || 1} userId={userId} size="sm" label="Láminas del álbum" className="mt-2" />
      {show.length > 0 ? (
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {show.map((a) => (
            <li key={a.id} className="flex justify-center">
              <Sticker id={a.id} icon={a.icon} name={a.name} number={a.number} rarity={a.rarity} earned size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-small mt-3 text-ink-soft">{isMe ? 'Tu primera lámina llega con tu primera sesión.' : 'Todavía no tiene láminas.'}</p>
      )}
    </>
  )
  return (
    <Section title={isMe ? 'Tu álbum' : `Álbum de ${name}`}>
      {isMe ? (
        <Surface as={Link} to="/logros" interactive aria-label={`Tu álbum: ${album.earned} de ${album.total} láminas. Abrir el álbum`}>
          {body}
        </Surface>
      ) : (
        <Surface>{body}</Surface>
      )}
    </Section>
  )
}

// ── Stats ───────────────────────────────────────────────────

function StatsSection({ userId }) {
  const stats = useMemberStats(userId)
  const minutes = formatTotalMinutes(stats.totals.minutes)
  const fav = stats.byType[0]
  const items = [
    { label: 'Sesiones', value: fmtNumber(stats.totals.sessions) },
    { label: 'Tiempo total', value: minutes.value, unit: minutes.unit },
    { label: 'Mejor racha', value: fmtNumber(stats.bests.bestWeeklyStreak), unit: stats.bests.bestWeeklyStreak === 1 ? 'semana' : 'semanas' },
    { label: 'Deporte favorito', value: fav?.type || 'Ninguno aún', small: true },
  ]
  return (
    <Section title="En números">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        {items.map((it) => (
          <div key={it.label} className="min-w-0 border-l-2 border-member pl-3">
            <dt className="type-small text-ink-soft">{it.label}</dt>
            <dd className={it.small ? 'type-sub mt-0.5 truncate text-ink' : 'type-heading mt-0.5 tabular-nums text-ink'}>
              {it.value}
              {it.unit && <span className="type-small ml-1 font-semibold text-ink-soft">{it.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

// ── Workout list ────────────────────────────────────────────

function WorkoutRows({ workouts, isMe, name, onOpen }) {
  const [count, setCount] = useState(ROWS_PAGE)
  const list = workouts.slice(0, count)
  const thisYear = new Date().getFullYear()
  return (
    <Section title={isMe ? 'Tus ejercicios' : `Ejercicios de ${name}`} description={workouts.length ? `${fmtNumber(workouts.length)} en total` : undefined}>
      {!list.length ? (
        <EmptyState compact icon={Dumbbell} title="Todavía no hay ejercicios" />
      ) : (
        <>
          <ul className="flex flex-col">
            {list.map((w) => {
              const meta = workoutMeta(w)
              return (
                <li key={w.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpen(w)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-ink/4"
                  >
                    <span className="size-14 shrink-0 overflow-hidden rounded-[10px] bg-surface-sunk">
                      {w.photoURL ? (
                        <img src={w.photoURL} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <Dumbbell size={20} strokeWidth={2} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="type-body block truncate font-semibold text-ink">{workoutTitle(w)}</span>
                      <span className="type-small block truncate text-ink-soft">{cap(longDate(w.date, thisYear))}</span>
                      {meta && <span className="type-caption block tabular-nums text-ink-soft">{meta}</span>}
                    </span>
                    <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-ink-faint" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          {workouts.length > count && (
            <Button variant="secondary" block className="mt-3" onClick={() => setCount((c) => c + ROWS_PAGE)}>
              Ver más ejercicios
            </Button>
          )}
        </>
      )}
    </Section>
  )
}

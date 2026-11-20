import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Plus } from 'lucide-react'
import { AvatarRing, Button, Skeleton, WeekStrip, memberProps } from '../../components/ui'
import { useFamily, useMemberWeek } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { weekDates, weekdayIndex } from '../../game/habits.js'
import { formatDayLong } from '../../utils/dates'
import { useLogSheet } from '../log/LogSheetContext'
import { getHeadline, getSubline, sessionsPerDay } from './todayCopy'
import HabitsToday from './HabitsToday'
import FamilyWeekToday from './FamilyWeekToday'
import GoalsToday from './GoalsToday'
import NextSticker from './NextSticker'

/**
 * Hoy — la pantalla que se abre todos los días. El titular ES el estado de la semana;
 * debajo, la racha y los días que quedan, la tira de la semana y el botón principal.
 * Luego: hábitos de hoy, la familia, las metas y la próxima lámina.
 */
export default function TodayPage() {
  const { ready } = useFamily()
  const { currentUser } = useAuth()
  if (!ready || !currentUser) return <TodaySkeleton />
  return <Today userId={currentUser.id} />
}

function Today({ userId }) {
  const { today, weekId } = useFamily()
  const { openLog } = useLogSheet()
  const week = useMemberWeek(userId)
  const todayIdx = weekdayIndex(today)
  const days = useMemo(() => sessionsPerDay(week.workouts, weekDates(weekId)), [week.workouts, weekId])
  const headline = getHeadline(week)
  const sub = getSubline(week)
  const dateText = formatDayLong(today)

  return (
    <div {...memberProps(userId)} className="pt-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <Link to={`/u/${userId}`} aria-label="Ver tu perfil" className="-m-1 rounded-full p-1">
            <AvatarRing
              userId={userId}
              src={week.avatar}
              name={week.member?.name || ''}
              segments={week.goal}
              filled={week.sessions}
              rest={week.rest && !week.met}
              size="lg"
            />
          </Link>
          <p className="type-small text-right font-medium text-ink-soft first-letter:uppercase">{dateText}</p>
        </div>

        <h1 className="type-display mt-5 text-ink">{headline.title}</h1>
        <p className="type-body mt-3 flex items-start gap-1.5 text-ink-soft">
          {sub.flame && <Flame size={18} strokeWidth={2.3} className="mt-[3px] shrink-0 text-member" aria-hidden="true" />}
          <span>{sub.text}</span>
        </p>

        <WeekStrip userId={userId} days={days} today={todayIdx} className="mt-6" />

        <Button block size="lg" icon={Plus} className="mt-6" onClick={() => openLog()}>
          Registrar ejercicio
        </Button>
      </header>

      <HabitsToday userId={userId} todayIdx={todayIdx} />
      <FamilyWeekToday userId={userId} todayIdx={todayIdx} />
      <GoalsToday userId={userId} />
      <NextSticker userId={userId} />
    </div>
  )
}

function TodaySkeleton() {
  return (
    <div className="pt-6" role="status" aria-label="Cargando tu semana">
      <div className="flex items-center justify-between">
        <Skeleton shape="circle" className="size-20" />
        <Skeleton className="w-32" />
      </div>
      <Skeleton className="mt-6 h-10 w-11/12" />
      <Skeleton className="mt-2 h-10 w-2/3" />
      <Skeleton className="mt-4 w-1/2" />
      <div className="mt-6 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} shape="circle" className="size-9" />
        ))}
      </div>
      <Skeleton shape="surface" className="mt-6 h-13" />
      <Skeleton className="mt-10 h-6 w-1/3" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="mt-4 h-12" />
      ))}
    </div>
  )
}

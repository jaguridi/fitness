import { useMemo, useState } from 'react'
import { ChartColumn, Plus } from 'lucide-react'
import {
  Avatar, Button, Chip, EmptyState, PageHeader, Section, SegmentedControl, cx, memberProps,
} from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { useFamily, useMemberStats } from '../../data/FamilyDataProvider'
import { getLeaderboard, lastWeeks } from '../../data/selectors'
import { useLogSheet } from '../log/LogSheetContext'
import Leaderboard from './Leaderboard'
import TrendChart from './TrendChart'
import ActivityHeatmap from './ActivityHeatmap'
import PersonalBests from './PersonalBests'
import MonthlyRecap from './MonthlyRecap'
import { SportBreakdown, WeekdayBreakdown } from './Breakdowns'
import { LEADERBOARD_METRICS, PERIODS, TREND_METRICS, weeklyMetricSeries } from './statsHelpers'

const TREND_WEEKS = 12

const PERIOD_TEXT = { 4: 'en las últimas 4 semanas', 12: 'en las últimas 12 semanas', all: 'desde que empezó la app' }
const POINTS_HINT = 'Los puntos premian la duración: 0,5 bajo 20 min, 1 hasta 44, 1,5 hasta 69, 2 hasta 99 y 2,5 desde 100 min.'

function MemberSwitcher({ members, value, onChange, currentUserId }) {
  return (
    <div role="radiogroup" aria-label="Ver el detalle de" className="-mx-1 grid grid-cols-4 gap-1">
      {members.map((m) => {
        const active = m.id === value
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            {...memberProps(m.id)}
            className={cx(
              'flex min-h-11 flex-col items-center gap-1.5 rounded-control px-1 py-2 transition-colors duration-150',
              active ? 'bg-member-tint' : 'hover:bg-ink/4'
            )}
          >
            <Avatar
              userId={m.id}
              src={m.avatar}
              name=""
              size="sm"
              className={cx('ring-offset-2 ring-offset-paper', active && 'ring-2 ring-member')}
            />
            <span className={cx('type-small leading-none', active ? 'font-semibold text-member-ink' : 'text-ink-soft')}>
              {m.id === currentUserId ? 'Tú' : m.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function MemberDetail({ userId, isMe, name }) {
  const { state, workouts, weekId, today } = useFamily()
  const { openLog } = useLogSheet()
  const stats = useMemberStats(userId, { weeks: TREND_WEEKS })
  const [metric, setMetric] = useState('sessions')

  const series = useMemo(() => {
    const ids = lastWeeks(weekId, TREND_WEEKS)
    const mine = workouts.filter((w) => w.userId === userId)
    const values = weeklyMetricSeries(mine, ids, metric)
    return values.map((v, i) => ({ ...v, goal: stats.weekly[i]?.goal, status: stats.weekly[i]?.status, met: stats.weekly[i]?.met }))
  }, [workouts, userId, weekId, metric, stats.weekly])

  if (!stats.totals.sessions) {
    return (
      <EmptyState
        className="mt-6"
        icon={ChartColumn}
        title={isMe ? 'Aún no tienes ejercicios registrados' : `${name} aún no registra ejercicios`}
        description={isMe ? 'Cuando registres tu primera sesión, aquí verás tus semanas, récords y días favoritos.' : 'Cuando registre su primera sesión, aquí aparecerán sus números.'}
        action={isMe && <Button icon={Plus} onClick={() => openLog()}>Registrar ejercicio</Button>}
      />
    )
  }

  const who = isMe ? 'Tu día favorito' : `El día favorito de ${name}`
  return (
    <>
      <Section as="h3" title="Semana a semana" description={`Últimas ${TREND_WEEKS} semanas. Toca una columna para ver el detalle.`} className="mt-8">
        <SegmentedControl label="Qué mostrar" value={metric} onChange={setMetric} options={TREND_METRICS} className="mb-5" />
        <TrendChart userId={userId} series={series} metric={metric} currentWeekId={state.weekId} />
        {metric === 'points' && <p className="type-caption mt-3 text-ink-soft">{POINTS_HINT}</p>}
      </Section>

      <Section as="h3" title="Récords" className="mt-10">
        <PersonalBests stats={stats} />
      </Section>

      <Section as="h3" title="Actividad" className="mt-10">
        <ActivityHeatmap userId={userId} activityByDate={stats.activityByDate} endWeekId={weekId} today={today} weeks={26} />
      </Section>

      {stats.byType.length > 0 && (
        <Section as="h3" title="Por deporte" className="mt-10">
          <SportBreakdown userId={userId} byType={stats.byType} />
        </Section>
      )}

      <Section as="h3" title="Por día de la semana" className="mt-10">
        <WeekdayBreakdown userId={userId} byWeekday={stats.byWeekday} who={who} />
      </Section>
    </>
  )
}

/** Estadísticas: ranking amistoso de la familia y el detalle de cada persona. */
export default function StatsPage() {
  const { currentUser } = useAuth()
  const { state, members } = useFamily()
  const me = currentUser?.id
  const [metric, setMetric] = useState('sessions')
  const [period, setPeriod] = useState('4')
  const [selectedId, setSelectedId] = useState(me || members[0]?.id)

  const weeks = period === 'all' ? 'all' : Number(period)
  const rows = useMemo(() => getLeaderboard(state, { metric, weeks }), [state, metric, weeks])
  const allZero = rows.every((r) => !r.value)
  const selected = members.find((m) => m.id === selectedId) || members[0]

  const selectFromBoard = (id) => {
    setSelectedId(id)
    requestAnimationFrame(() => document.getElementById('detalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <>
      <PageHeader title="Estadísticas" description="Cómo se mueve la familia y tus propios números." back />

      <Section
        title="La familia"
        description={metric === 'streak' ? 'Semanas logradas seguidas, contando la de hoy si ya está lista.' : `Total ${PERIOD_TEXT[period]}.`}
      >
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Qué comparar">
          {LEADERBOARD_METRICS.map((m) => (
            <Chip key={m.value} size="sm" selected={metric === m.value} onClick={() => setMetric(m.value)}>
              {m.label}
            </Chip>
          ))}
        </div>
        {metric !== 'streak' && (
          <SegmentedControl label="Periodo" value={period} onChange={setPeriod} options={PERIODS} className="mb-4" />
        )}
        {allZero ? (
          <p className="type-small rounded-control bg-surface-sunk px-4 py-3 text-ink-soft">
            {metric === 'streak'
              ? 'Nadie tiene racha todavía. La primera semana lograda la empieza.'
              : metric === 'calories'
                ? 'Nadie anotó calorías en este periodo.'
                : 'Todavía no hay sesiones en este periodo.'}
          </p>
        ) : (
          <Leaderboard rows={rows} metric={metric} currentUserId={me} selectedId={selectedId} onSelect={selectFromBoard} />
        )}
        {metric === 'points' && <p className="type-caption mt-3 text-ink-soft">{POINTS_HINT}</p>}
      </Section>

      <Section title="El mes pasado" className="mt-10">
        <MonthlyRecap />
      </Section>

      <section id="detalle" aria-label="Detalle por persona" className="mt-10 scroll-mt-4">
        <h2 className="type-sub mb-3 text-ink">{selected?.id === me ? 'Tus números' : `Los números de ${selected?.name}`}</h2>
        <MemberSwitcher members={members} value={selected?.id} onChange={setSelectedId} currentUserId={me} />
        {selected && <MemberDetail key={selected.id} userId={selected.id} isMe={selected.id === me} name={selected.name} />}
      </section>
    </>
  )
}

import { useMemo } from 'react'
import { Archive, Heart, Shield } from 'lucide-react'
import { Avatar, EmptyState, PageHeader, Section, memberProps } from '../../components/ui'
import { useFamily } from '../../data/FamilyDataProvider'
import { formatCLP } from '../../constants'
import { formatWeekLabel } from '../../utils/dates'
import { ARCHIVE_STATUSES, buildArchive } from './archive'
import { formatNumber, weekStartLabel } from '../stats/statsHelpers'

const plural = (n, one, many) => (n === 1 ? one : many)

/** Cómo se ve cada estado v1 en la tira. Tokens del sistema; "no salió" nunca en rojo. */
const STATUS = {
  completed: { label: 'Lograda', style: { background: 'var(--done)' } },
  missed: { label: 'No salió', style: { background: 'var(--ink-faint)' } },
  justified: { label: 'Justificada', style: { background: 'var(--rar-epica)' } },
  frozen: { label: 'Congelada', style: { background: 'var(--rar-rara)' } },
  holiday: { label: 'Feriado', style: { background: 'var(--rar-legendaria)' } },
  paused: { label: 'En pausa', style: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--line-strong)' } },
}
const EMPTY_CELL = { background: 'var(--surface-sunk)' }

function seasonSpan(first, last) {
  if (!first) return ''
  const start = formatWeekLabel(first).split(' - ')[0]
  const end = formatWeekLabel(last).split(' - ')[1]
  return `Del ${start} al ${end}`
}

function WeekStrip({ weeks }) {
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${weeks.filter((w) => w.status === 'completed').length} semanas logradas de ${weeks.length}`}
    >
      {weeks.map((w) => (
        <span
          key={w.weekId}
          title={`Semana del ${weekStartLabel(w.weekId)}: ${w.status ? STATUS[w.status].label.toLowerCase() : 'sin registro'}${
            w.lifeUsed ? ' (con una vida)' : ''
          }${w.holidayName ? ` (${w.holidayName})` : ''}`}
          className="h-6 rounded-[3px]"
          style={w.status ? STATUS[w.status].style : EMPTY_CELL}
        />
      ))}
    </div>
  )
}

function MemberClosure({ row }) {
  const m = row.member
  const totalWeeks = row.weeks.filter((w) => w.status).length
  return (
    <li {...memberProps(row.id)} className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <Avatar userId={row.id} src={m.avatar} name="" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="type-body font-semibold text-ink">{row.name}</p>
          <p className="type-small text-ink-soft tabular-nums">
            {row.achieved} de {totalWeeks} {plural(totalWeeks, 'semana lograda', 'semanas logradas')}, {formatNumber(row.sessions)}{' '}
            {plural(row.sessions, 'sesión', 'sesiones')}
          </p>
        </div>
        <div className="text-right">
          <p className="type-body font-semibold tabular-nums text-ink">{formatCLP(row.fines)}</p>
          <p className="type-caption text-ink-faint">al pozo</p>
        </div>
      </div>
      <div className="mt-3">
        <WeekStrip weeks={row.weeks} />
      </div>
      <p className="type-small mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
        <span>
          Mejor racha: <span className="font-semibold text-ink tabular-nums">{row.bestStreak}</span>
        </span>
        {row.lives > 0 && (
          <span className="inline-flex items-center gap-1">
            <Heart aria-hidden="true" size={14} strokeWidth={2.4} />
            {row.lives} {plural(row.lives, 'vida guardada', 'vidas guardadas')}
          </span>
        )}
        {row.shield && (
          <span className="inline-flex items-center gap-1">
            <Shield aria-hidden="true" size={14} strokeWidth={2.4} />
            Terminó con escudo
          </span>
        )}
      </p>
    </li>
  )
}

/** Archivo: el cierre de la temporada 1 ("la era de las multas"), solo lectura. */
export default function ArchivePage() {
  const { members, summaries } = useFamily()
  const a = useMemo(() => buildArchive({ members, summaries }), [members, summaries])

  if (!a.hasData) {
    return (
      <>
        <PageHeader title="Temporada 1" description="La era de las multas." back="/perfil" />
        <EmptyState
          icon={Archive}
          title="No hay nada archivado aquí"
          description="Este espacio guarda el cierre de la temporada de multas, pero en estos datos no hay semanas de esa época. La temporada 2 parte limpia: sin multas y sin deudas."
        />
      </>
    )
  }

  const usedStatuses = ARCHIVE_STATUSES.filter((s) => a.members.some((r) => r.counts[s] > 0))

  return (
    <>
      <PageHeader
        title="Temporada 1: la era de las multas"
        description={`${seasonSpan(a.firstWeekId, a.lastWeekId)}. ${a.weekIds.length} semanas de pozo, vidas, escudos y canjes.`}
        back="/perfil"
      />

      <p className="type-body rounded-control bg-surface-sunk px-4 py-3.5 text-ink">
        Se acabaron las multas. Esto queda como recuerdo: nada de lo que aparece aquí se cobra ni se debe dentro de la app.
      </p>

      <Section title="El pozo final" className="mt-9">
        <p className="type-display tabular-nums text-ink">{formatCLP(a.pot)}</p>
        <p className="type-small mt-2 max-w-[36ch] text-ink-soft">
          Lo que juntó la familia entre todos, junto a {formatNumber(a.totalSessions)} sesiones y {a.weeksAchieved}{' '}
          {plural(a.weeksAchieved, 'semana lograda', 'semanas logradas')}.
        </p>
      </Section>

      <Section title="Cada uno" description="Una barrita por semana de la temporada, de la primera a la última." className="mt-10">
        <ul>
          {a.members.map((row) => (
            <MemberClosure key={row.id} row={row} />
          ))}
        </ul>
        <ul className="type-small mt-4 flex flex-wrap gap-x-4 gap-y-2 text-ink-soft" aria-label="Leyenda">
          {usedStatuses.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-[3px]" style={STATUS[s].style} />
              {STATUS[s].label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-[3px]" style={EMPTY_CELL} />
            Sin registro
          </li>
        </ul>
      </Section>

      <Section title="Gracias, temporada 1" className="mt-10">
        <p className="type-body text-ink-soft">
          Las multas nos hicieron movernos más de lo que pensábamos, hasta que dejaron de ser divertidas. La temporada 2 se queda
          con lo bueno: las fotos, las reacciones y los comentarios, ahora con metas propias, rachas y un álbum de láminas.
        </p>
      </Section>
    </>
  )
}

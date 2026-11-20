import { formatExerciseTypes } from '../../constants'
import { formatDayShort } from '../../utils/dates'
import { formatNumber, weekStartLabel } from './statsHelpers'

function Figure({ label, value, unit, detail }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="type-small text-ink-soft">{label}</dt>
      <dd className="mt-0.5">
        <span className="type-heading tabular-nums text-ink">{value}</span>
        {unit && <span className="type-small ml-1 text-ink-soft">{unit}</span>}
        {detail && <span className="type-caption mt-0.5 block text-ink-faint">{detail}</span>}
      </dd>
    </div>
  )
}

const plural = (n, one, many) => (n === 1 ? one : many)

/** Récords personales como cifras sobre el papel (no tarjetas). */
export default function PersonalBests({ stats }) {
  const { bests, totals, averages } = stats
  const longest = bests.longestSession
  const cal = bests.mostCalories
  const items = [
    {
      label: 'Racha actual',
      value: bests.currentWeeklyStreak,
      unit: plural(bests.currentWeeklyStreak, 'semana', 'semanas'),
      detail: `La mejor: ${bests.bestWeeklyStreak} ${plural(bests.bestWeeklyStreak, 'semana', 'semanas')}`,
    },
    {
      label: 'Días seguidos',
      value: bests.bestDayStreak,
      unit: plural(bests.bestDayStreak, 'día', 'días'),
      detail: bests.currentDayStreak > 0 ? `Ahora: ${bests.currentDayStreak}` : 'Lo más largo sin cortar',
    },
    longest && {
      label: 'Sesión más larga',
      value: formatNumber(longest.duration),
      unit: 'min',
      detail: [formatExerciseTypes(longest), longest.date && formatDayShort(longest.date)].filter(Boolean).join(', '),
    },
    cal && Number(cal.calories) > 0 && {
      label: 'Más calorías',
      value: formatNumber(cal.calories),
      unit: 'kcal',
      detail: [formatExerciseTypes(cal), cal.date && formatDayShort(cal.date)].filter(Boolean).join(', '),
    },
    bests.bestWeekSessions && {
      label: 'Mejor semana',
      value: bests.bestWeekSessions.value,
      unit: plural(bests.bestWeekSessions.value, 'sesión', 'sesiones'),
      detail: `Semana del ${weekStartLabel(bests.bestWeekSessions.weekId)}`,
    },
    bests.bestWeekMinutes && {
      label: 'Más minutos en una semana',
      value: formatNumber(bests.bestWeekMinutes.value),
      unit: 'min',
      detail: `Semana del ${weekStartLabel(bests.bestWeekMinutes.weekId)}`,
    },
    {
      label: 'En total',
      value: formatNumber(totals.sessions),
      unit: plural(totals.sessions, 'sesión', 'sesiones'),
      detail: `${formatNumber(totals.minutes)} min en ${totals.activeWeeks} ${plural(totals.activeWeeks, 'semana', 'semanas')}`,
    },
    {
      label: 'Sesión promedio',
      value: averages.minutesPerSession,
      unit: 'min',
      detail: `${formatNumber(averages.sessionsPerWeek)} sesiones por semana`,
    },
  ].filter(Boolean)

  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
      {items.map((it) => (
        <Figure key={it.label} {...it} />
      ))}
    </dl>
  )
}

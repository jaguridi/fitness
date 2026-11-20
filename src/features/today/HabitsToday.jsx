import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus, Sparkles } from 'lucide-react'
import { EmptyState, HabitDots, Section, cx } from '../../components/ui'
import { useFamily, useHabitProgress } from '../../data/FamilyDataProvider'
import { weekDates } from '../../game/habits.js'
import LinkButton from './LinkButton'

/**
 * "Tus hábitos": la lista de hoy. Cada fila marca o desmarca un día con un toque
 * (hoy o un día anterior de esta semana), con respuesta inmediata: el cambio se ve
 * al tiro y se revierte con un aviso si no se pudo guardar.
 */
export default function HabitsToday({ userId, todayIdx }) {
  const { weekId, actions } = useFamily()
  const habits = useHabitProgress(userId)
  const [pending, setPending] = useState({}) // `${habitId}:${i}` → valor optimista
  const dates = weekDates(weekId)

  const toggle = (h, i) => {
    const key = `${h.habitId}:${i}`
    if (key in pending) return // ya va en camino
    setPending((p) => ({ ...p, [key]: !h.days[i] }))
    actions
      .toggleHabitCheck(h.habitId, dates[i])
      .catch((err) => {
        console.error('toggleHabitCheck failed:', err)
        toast.error(err?.message || 'No se pudo guardar el hábito. Inténtalo de nuevo.')
      })
      .finally(() =>
        setPending((p) => {
          const next = { ...p }
          delete next[key]
          return next
        })
      )
  }

  if (!habits.length) {
    return (
      <Section title="Tus hábitos">
        <EmptyState
          compact
          icon={Sparkles}
          title="Suma un hábito a tu semana"
          description="Algo chico para marcar cada día: leer, meditar, tomar agua o estirar."
          action={
            <LinkButton to="/habitos" size="sm" icon={Plus}>
              Crear mi primer hábito
            </LinkButton>
          }
        />
      </Section>
    )
  }

  const rows = habits.map((h) => {
    const days = h.days.map((d, i) => (`${h.habitId}:${i}` in pending ? pending[`${h.habitId}:${i}`] : d))
    const done = days.filter(Boolean).length
    return { ...h, days, done, met: done >= h.target, checkedToday: todayIdx >= 0 && days[todayIdx] }
  })
  const markedToday = rows.filter((r) => r.checkedToday).length

  return (
    <Section
      title="Tus hábitos"
      description={
        markedToday === rows.length
          ? 'Todo marcado por hoy.'
          : markedToday === 0
            ? 'Toca un punto para marcarlo.'
            : `Hoy llevas ${markedToday} de ${rows.length}.`
      }
      action={
        <LinkButton to="/habitos" variant="ghost" size="sm">
          Editar
        </LinkButton>
      }
    >
      <ul className="flex flex-col">
        {rows.map((h) => (
          <li key={h.habitId} className="border-b border-line py-3 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="text-xl leading-none">
                {h.emoji || '✨'}
              </span>
              <span className="type-body min-w-0 flex-1 truncate font-semibold text-ink">{h.name}</span>
              <span
                className={cx(
                  'type-small inline-flex shrink-0 items-center gap-1 tabular-nums',
                  h.met ? 'font-semibold text-done-ink' : 'text-ink-soft'
                )}
              >
                {h.met && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                {h.done} de {h.target}
                {h.met && <span className="sr-only">, logrado esta semana</span>}
              </span>
            </div>
            <HabitDots
              checks={h.days}
              target={h.target}
              today={todayIdx}
              userId={userId}
              habitName={h.name}
              onToggle={(i) => toggle(h, i)}
              showCount={false}
              className="-ml-3.5 mt-0.5"
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}

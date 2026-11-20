import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { GoalProgress, Section } from '../../components/ui'
import { useGoals } from '../../data/FamilyDataProvider'
import { goalUnit } from './todayCopy'
import LinkButton from './LinkButton'

const MAX_GOALS = 3

/**
 * "Tus metas": hasta 3 metas personales activas (la que vence antes primero).
 * Sin metas, una sola línea que invita a crear una.
 */
export default function GoalsToday({ userId }) {
  const navigate = useNavigate()
  const goals = useGoals(userId).filter((g) => g.state === 'active')

  if (!goals.length) {
    return (
      <Section title="Tus metas">
        <div className="flex items-center justify-between gap-3">
          <p className="type-small text-ink-soft">Ponte una meta con plazo, y un premio si quieres.</p>
          <LinkButton to="/metas" variant="ghost" size="sm" icon={Plus} className="shrink-0">
            Crear meta
          </LinkButton>
        </div>
      </Section>
    )
  }

  const shown = goals.slice(0, MAX_GOALS)
  return (
    <Section
      title="Tus metas"
      action={
        <LinkButton to="/metas" variant="ghost" size="sm">
          {goals.length > MAX_GOALS ? `Ver las ${goals.length}` : 'Ver metas'}
        </LinkButton>
      }
    >
      <ul className="flex flex-col gap-2">
        {shown.map((g) => (
          <li key={g.id}>
            <GoalProgress
              userId={userId}
              emoji={g.goal.emoji}
              title={g.goal.title}
              current={g.progress.current}
              target={g.progress.target}
              unit={goalUnit(g.goal)}
              daysLeft={g.daysLeft}
              reward={g.goal.reward}
              status="active"
              own
              onClick={() => navigate('/metas')}
              className="-mx-2 p-2"
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}

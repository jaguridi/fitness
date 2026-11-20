import { Lock } from 'lucide-react'
import { GoalProgress, Tag, cx } from '../../components/ui'
import { goalPaceHint, goalUnit } from './goalForm'

/**
 * GoalItem — a goal in a list: GoalProgress plus a kind pace hint and a
 * "Privada" tag. A list item (no box).
 *
 *   <ul><GoalItem view={getGoalView(state, goal)} today={today} own onOpen={() => …} /></ul>
 *
 * @param {object} view   getGoalView() result
 * @param {string} today  'yyyy-MM-dd'
 * @param {boolean} [own] the viewer owns the goal ("Si lo logras")
 * @param {()=>void} [onOpen]
 */
export default function GoalItem({ view, today, own = false, onOpen, className }) {
  const { goal, progress, state, daysLeft } = view
  const hint = goalPaceHint(view, today)
  const isPrivate = goal.visibility === 'private'
  return (
    <li className={cx('border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0', className)}>
      <GoalProgress
        userId={goal.userId}
        emoji={goal.emoji}
        title={goal.title}
        current={progress.current}
        target={progress.target}
        unit={goalUnit(goal, progress.target)}
        daysLeft={daysLeft}
        reward={state === 'cancelled' ? undefined : goal.reward}
        status={state}
        own={own}
        onClick={onOpen}
      />
      {(hint || isPrivate) && (
        <p className="type-small mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-14 text-ink-soft">
          {isPrivate && <Tag icon={Lock}>Privada</Tag>}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </li>
  )
}

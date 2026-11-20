import { useState } from 'react'
import { toast } from 'sonner'
import { Check, CircleCheck, Gift, Lock, Minus, Pencil, Plus } from 'lucide-react'
import { useFamily } from '../../data/FamilyDataProvider'
import { formatYMD } from '../../game/habits'
import { toMillis } from '../../utils/dates'
import { Button, IconButton, ProgressBar, Sheet, Tag, cx, memberProps } from '../../components/ui'
import {
  countsSentence,
  describeGoal,
  fmtNumber,
  formFromGoal,
  formatAmount,
  formatDay,
  formatShortDay,
  goalContributions,
  goalPaceHint,
} from './goalForm'

const MAX_ROWS = 8

const daysLabel = (n) => (n <= 1 ? 'Último día' : `Quedan ${n} días`)

/**
 * GoalDetailSheet — one goal up close: progress, pace, what counted (auto) or
 * the progress editor (manual), and the edit / cancel actions.
 *
 * @param {object|null} view  getGoalView() of the goal (null closes the sheet)
 * @param {object[]} workouts the owner's workouts
 * @param {object[]} habitWeeks the owner's habit_week docs
 * @param {()=>void} onClose
 * @param {()=>void} [onEdit]
 * @param {()=>void} [onCancel]
 */
export default function GoalDetailSheet({ view, workouts = [], habitWeeks = [], onClose, onEdit, onCancel }) {
  const { today } = useFamily()
  if (!view) return null
  const { goal, progress, state, daysLeft } = view
  const active = state === 'active'
  const habitName = view.habit?.name
  const hint = goalPaceHint(view, today)
  const achievedMs = toMillis(goal.achievedAt)

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal.title}
      description={describeGoal(formFromGoal(goal, today), { habitName })}
      footer={
        active && (onEdit || onCancel) ? (
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="secondary" icon={Pencil} onClick={onEdit} className="flex-1">
                Editar meta
              </Button>
            )}
            {onCancel && (
              <Button variant="danger-quiet" onClick={onCancel}>
                Cancelar meta
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div {...memberProps(goal.userId)} className="flex flex-col gap-6">
        {state === 'achieved' && (
          <div className="flex items-start gap-3 rounded-surface bg-done-soft p-4">
            <CircleCheck size={28} strokeWidth={2.2} className="animate-pop shrink-0 text-done-ink" aria-hidden="true" />
            <div>
              <p className="type-sub text-ink">Meta lograda</p>
              <p className="type-small mt-0.5 text-ink-soft">
                {achievedMs ? `La lograste el ${formatDay(formatYMD(new Date(achievedMs)))}.` : 'Llegaste al objetivo.'}
                {goal.reward ? ' Ahora, a disfrutar el premio.' : ''}
              </p>
            </div>
          </div>
        )}
        {state === 'missed' && (
          <p className="type-small rounded-surface bg-surface-sunk p-4 text-ink-soft">
            El plazo terminó antes de llegar. Lo avanzado cuenta igual; puedes proponerte otra cuando quieras.
          </p>
        )}

        <div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cx(
                'flex size-14 shrink-0 items-center justify-center rounded-control text-[30px] leading-none',
                state === 'achieved' ? 'bg-done-soft' : 'bg-member-tint',
                (state === 'missed' || state === 'cancelled') && 'grayscale'
              )}
            >
              {goal.emoji || '🎯'}
            </span>
            <p className="min-w-0">
              <span className="type-heading block tabular-nums text-ink">
                {fmtNumber(progress.current)}
                <span className="type-body font-medium text-ink-soft"> de {formatAmount(goal, progress.target)}</span>
              </span>
              {active && <span className="type-small block text-ink-soft">{daysLabel(daysLeft)}</span>}
            </p>
          </div>
          <ProgressBar
            value={progress.current}
            max={progress.target}
            tone={state === 'achieved' ? 'done' : active ? 'member' : 'ink'}
            label={goal.title}
            className={cx('mt-3', !active && state !== 'achieved' && 'opacity-40')}
          />
          {goal.reward && (
            <p className={cx('type-small mt-3 flex items-start gap-1.5', state === 'achieved' ? 'text-done-ink' : 'text-ink-soft')}>
              <Gift size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {state === 'achieved' ? 'Te ganaste: ' : 'Si lo logras: '}
                {goal.reward}
              </span>
            </p>
          )}
          {(hint || goal.visibility === 'private') && (
            <p className="type-small mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
              {goal.visibility === 'private' && <Tag icon={Lock}>Privada</Tag>}
              {hint && <span>{hint}</span>}
            </p>
          )}
        </div>

        {goal.kind === 'manual' ? (
          active && <ManualProgress key={goal.id} goal={goal} target={progress.target} />
        ) : (
          <Counted goal={goal} habitName={habitName} workouts={workouts} habitWeeks={habitWeeks} />
        )}
      </div>
    </Sheet>
  )
}

/** Progress editor for manual goals: − / input / + and "Marcar como lograda". */
function ManualProgress({ goal, target }) {
  const { actions } = useFamily()
  const saved = Math.max(0, Number(goal.progress) || 0)
  const [value, setValue] = useState(String(saved))
  const [busy, setBusy] = useState(null)
  const num = Number(String(value).replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(num) && num >= 0
  const step = target >= 50 ? 5 : 1
  const unit = goal.unit ? goal.unit : ''

  const commit = async (next, kind) => {
    try {
      setBusy(kind)
      await actions.updateGoalProgress(goal.id, next)
      if (next >= target) {
        toast.success('¡Meta lograda!', { description: goal.reward ? `Te ganaste: ${goal.reward}` : 'Llegaste al objetivo.' })
      } else {
        toast.success('Avance guardado', { description: `Vas en ${fmtNumber(next)} de ${fmtNumber(target)}${unit ? ` ${unit}` : ''}.` })
      }
    } catch (err) {
      console.error('updateGoalProgress failed:', err)
      toast.error('No se pudo guardar el avance. Inténtalo de nuevo.')
    } finally {
      setBusy(null)
    }
  }

  const bump = (d) => {
    const base = valid ? num : saved
    setValue(String(Math.max(0, Math.round((base + d) * 10) / 10)))
  }

  return (
    <div>
      <p className="type-small mb-2 font-semibold text-ink">Tu avance</p>
      <div className="flex items-center gap-2">
        <IconButton icon={Minus} label="Restar" variant="surface" onClick={() => bump(-step)} disabled={valid && num <= 0} />
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Avance"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
            className={cx(
              'h-12 w-full rounded-control border bg-surface px-4 text-center text-xl font-bold tabular-nums text-ink',
              'focus:outline-none focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]',
              valid ? 'border-line-strong' : 'border-danger'
            )}
          />
        </div>
        <IconButton icon={Plus} label="Sumar" variant="surface" onClick={() => bump(step)} />
      </div>
      <p className="type-small mt-2 text-center text-ink-soft tabular-nums">
        de {fmtNumber(target)}
        {unit ? ` ${unit}` : ''}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button block onClick={() => commit(num, 'save')} disabled={!valid || num === saved} loading={busy === 'save'}>
          Guardar avance
        </Button>
        <Button block variant="ghost" icon={Check} onClick={() => commit(target, 'done')} loading={busy === 'done'}>
          Marcar como lograda
        </Button>
      </div>
    </div>
  )
}

/** "What counted" for auto goals, so the number never feels like a black box. */
function Counted({ goal, habitName, workouts, habitWeeks }) {
  const c = goalContributions(goal, { workouts, habitWeeks })
  return (
    <div>
      <p className="type-small font-semibold text-ink">Lo que cuenta</p>
      <p className="type-small mt-0.5 text-ink-soft">{countsSentence(goal, { habitName })}</p>
      {c.kind === 'habit' ? (
        c.dates.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Días marcados">
            {c.dates.map((d) => (
              <li key={d}>
                <Tag tone="member" userId={goal.userId} className="tabular-nums">
                  {formatShortDay(d)}
                </Tag>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-small mt-3 text-ink-soft">Todavía no hay días marcados en este plazo.</p>
        )
      ) : c.items.length ? (
        <ul className="mt-2 flex flex-col">
          {c.items.slice(0, MAX_ROWS).map((w) => (
            <li key={w.id} className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
              <span className="type-small w-20 shrink-0 tabular-nums text-ink-soft">{formatShortDay(w.date)}</span>
              <span className="type-small min-w-0 flex-1 truncate text-ink">{w.types.join(' + ') || 'Ejercicio'}</span>
              <span className="type-small shrink-0 tabular-nums text-ink-soft">
                {goal.metric === 'calories' ? `${fmtNumber(w.calories)} kcal` : `${fmtNumber(w.duration)} min`}
              </span>
            </li>
          ))}
          {c.items.length > MAX_ROWS && (
            <li className="type-small pt-2 text-ink-soft">
              y {c.items.length - MAX_ROWS} {c.items.length - MAX_ROWS === 1 ? 'sesión más' : 'sesiones más'}
            </li>
          )}
        </ul>
      ) : (
        <p className="type-small mt-3 text-ink-soft">Todavía no hay sesiones que cuenten en este plazo.</p>
      )}
    </div>
  )
}

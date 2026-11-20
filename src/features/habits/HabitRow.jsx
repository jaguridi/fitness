import { CalendarCheck, Check, ChevronDown, ChevronUp, Flame, Lock, Pencil } from 'lucide-react'
import { HabitDots, IconButton, Tag, cx, memberProps } from '../../components/ui'
import { dayStreakLabel, habitTargetLabel, weekStreakLabel } from './habitForm'

/**
 * HabitRow — one habit of the week: emoji, name, target, streaks, private tag
 * and its 7 dots. A list item (no box): put several in a <ul>.
 *
 *   <HabitRow item={row} userId="user1" todayIndex={4} onToggle={(i) => …} onEdit={() => …} />
 *   <HabitRow item={row} reorder canUp canDown onMove={(dir) => …} />   // sort mode
 *   <HabitRow item={row} todayIndex={-1} />                             // read-only dots
 *
 * @param {object} item  a getHabitProgress() row
 * @param {string} [userId] member color for the dots and emoji tile
 * @param {number} [todayIndex=-1] Mon=0…Sun=6; -1 = read only
 * @param {(dayIndex:number)=>void} [onToggle]
 * @param {()=>void} [onEdit]
 * @param {boolean} [reorder] shows up/down instead of the dots
 * @param {(dir:-1|1)=>void} [onMove]
 */
export default function HabitRow({
  item,
  userId,
  todayIndex = -1,
  onToggle,
  onEdit,
  reorder = false,
  canUp = false,
  canDown = false,
  onMove,
  className,
}) {
  const weeks = weekStreakLabel(item.weekStreak)
  const days = item.isDaily ? dayStreakLabel(item.dayStreak) : null
  return (
    <li {...memberProps(userId)} className={cx('border-b border-line py-3 last:border-b-0', className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-control text-[22px] leading-none',
            item.met ? 'bg-done-soft' : 'bg-member-tint'
          )}
        >
          {item.emoji || '✅'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="type-body truncate font-semibold text-ink">{item.name}</span>
            {item.visibility === 'private' && (
              <Tag icon={Lock} className="shrink-0">
                Privado
              </Tag>
            )}
          </p>
          <p className="type-small mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-soft">
            <span>{habitTargetLabel(item.target)}</span>
            {weeks && (
              <span className="inline-flex items-center gap-1">
                <Flame size={14} strokeWidth={2.4} className="text-member" aria-hidden="true" />
                {weeks}
              </span>
            )}
            {days && (
              <span className="inline-flex items-center gap-1">
                <CalendarCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                {days}
              </span>
            )}
          </p>
        </div>
        {reorder ? (
          <div className="-mr-2 flex shrink-0">
            <IconButton icon={ChevronUp} label={`Subir ${item.name}`} disabled={!canUp} onClick={() => onMove?.(-1)} />
            <IconButton icon={ChevronDown} label={`Bajar ${item.name}`} disabled={!canDown} onClick={() => onMove?.(1)} />
          </div>
        ) : (
          <>
            <span
              className={cx(
                'type-small inline-flex shrink-0 items-center gap-1 tabular-nums',
                item.met ? 'font-semibold text-done-ink' : 'text-ink-soft'
              )}
            >
              {item.met && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}
              {item.done} de {item.target}
            </span>
            {onEdit && <IconButton icon={Pencil} label={`Editar ${item.name}`} onClick={onEdit} className="-mr-2" />}
          </>
        )}
      </div>
      {!reorder && (
        <HabitDots
          checks={item.days}
          target={item.target}
          today={todayIndex}
          userId={userId}
          habitName={item.name}
          onToggle={onToggle}
          showCount={false}
          className={cx('mt-1', onToggle && todayIndex >= 0 ? 'ml-[42px]' : 'ml-14')}
        />
      )}
    </li>
  )
}

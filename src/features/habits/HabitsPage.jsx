import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Flame, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useFamily, useHabitProgress } from '../../data/FamilyDataProvider'
import { weekDates } from '../../game/habits'
import { HABIT_SUGGESTIONS } from '../../constants'
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  ProgressBar,
  Section,
  cx,
  memberProps,
} from '../../components/ui'
import HabitRow from './HabitRow'
import HabitEditorSheet from './HabitEditorSheet'
import { availableSuggestions, moveItem, summarizeHabits } from './habitForm'

/** Hábitos (/habitos) — the current user's habits for this week. */
export default function HabitsPage() {
  const { currentUser } = useAuth()
  const me = currentUser?.id
  const { habits, weekId, today, actions } = useFamily()
  const rows = useHabitProgress(me)
  const myHabits = useMemo(() => habits.filter((h) => h.userId === me), [habits, me])
  const archived = useMemo(
    () => myHabits.filter((h) => h.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [myHabits]
  )
  const dates = useMemo(() => weekDates(weekId), [weekId])
  const todayIndex = dates.indexOf(today)
  const summary = summarizeHabits(rows)

  const [editor, setEditor] = useState(null) // { key, habit?, suggestion? }
  const [toArchive, setToArchive] = useState(null)
  const [reorder, setReorder] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const pending = useRef(new Set())

  const openNew = (suggestion = null) => setEditor({ key: Date.now(), suggestion })
  const openEdit = (habit) => setEditor({ key: Date.now(), habit })

  const toggle = async (habitId, dayIndex) => {
    const date = dates[dayIndex]
    const k = `${habitId}:${date}`
    if (!date || pending.current.has(k)) return
    pending.current.add(k)
    try {
      await actions.toggleHabitCheck(habitId, date)
    } catch (err) {
      console.error('toggleHabitCheck failed:', err)
      toast.error(err?.message?.startsWith('Solo puedes') ? err.message : 'No se pudo marcar el hábito. Inténtalo de nuevo.')
    } finally {
      pending.current.delete(k)
    }
  }

  const move = async (index, dir) => {
    const ids = rows.map((r) => r.habitId)
    const next = moveItem(ids, index, dir)
    if (next === ids) return
    try {
      await actions.reorderHabits(next)
    } catch (err) {
      console.error('reorderHabits failed:', err)
      toast.error('No se pudo cambiar el orden. Inténtalo de nuevo.')
    }
  }

  const archive = async () => {
    const h = toArchive
    try {
      await actions.archiveHabit(h.id, true)
      setEditor(null)
      toast('Hábito archivado', { description: 'Lo encuentras en Archivados, abajo.' })
    } catch (err) {
      console.error('archiveHabit failed:', err)
      toast.error('No se pudo archivar el hábito. Inténtalo de nuevo.')
    }
  }

  const restore = async (h) => {
    try {
      await actions.archiveHabit(h.id, false)
      toast.success('Hábito restaurado', { description: `${h.name} vuelve a tu semana.` })
    } catch (err) {
      console.error('restore habit failed:', err)
      toast.error('No se pudo restaurar el hábito. Inténtalo de nuevo.')
    }
  }

  const empty = rows.length === 0
  const ideas = availableSuggestions(HABIT_SUGGESTIONS, myHabits).slice(0, 6)

  return (
    <div {...memberProps(me)} className="pb-6">
      <PageHeader
        back
        title="Hábitos"
        description={
          empty
            ? 'Lo que quieres sostener cada semana, a tu ritmo.'
            : 'Márcalos con un toque, hoy o cualquier día que ya pasó de esta semana.'
        }
      />

      {empty ? (
        <EmptyState
          icon={Sparkles}
          title={archived.length ? 'No tienes hábitos activos' : 'Aún no tienes hábitos'}
          description="Elige uno chico para empezar. Toca una idea y ajústala a tu gusto."
          action={
            <div className="flex flex-col items-start gap-4">
              <div className="flex flex-wrap gap-2">
                {ideas.map((s) => (
                  <Chip key={s.name} emoji={s.emoji} onClick={() => openNew(s)}>
                    {s.name}
                  </Chip>
                ))}
              </div>
              <Button icon={Plus} onClick={() => openNew()}>
                Crear hábito
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <section aria-label="Resumen de la semana" className="mb-9">
            <p className="type-small font-semibold text-ink-soft">Esta semana</p>
            <p className="type-heading mt-1 text-ink">
              {summary.met === summary.total
                ? summary.total === 1
                  ? 'Lograste tu hábito'
                  : `Lograste los ${summary.total} hábitos`
                : `${summary.met} de ${summary.total} ${summary.total === 1 ? 'hábito logrado' : 'hábitos logrados'}`}
            </p>
            <ProgressBar
              value={summary.met}
              max={summary.total}
              tone={summary.met === summary.total ? 'done' : 'member'}
              size="sm"
              label="Hábitos logrados esta semana"
              className="mt-3"
            />
            <p className="type-small mt-3 flex items-center gap-1.5 text-ink-soft">
              <Flame size={16} strokeWidth={2.4} className="shrink-0 text-member" aria-hidden="true" />
              {summary.best ? (
                <span>
                  Tu mejor racha ahora: {summary.best.emoji} {summary.best.name},{' '}
                  {summary.best.weeks === 1 ? '1 semana' : `${summary.best.weeks} semanas`}.
                </span>
              ) : (
                <span>Cada hábito que logres esta semana empieza su racha.</span>
              )}
            </p>
          </section>

          <Section
            title="Tus hábitos"
            action={
              rows.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setReorder((r) => !r)} aria-pressed={reorder}>
                  {reorder ? 'Listo' : 'Ordenar'}
                </Button>
              )
            }
          >
            <ul className="flex flex-col">
              {rows.map((row, i) => (
                <HabitRow
                  key={row.habitId}
                  item={row}
                  userId={me}
                  todayIndex={todayIndex}
                  onToggle={(d) => toggle(row.habitId, d)}
                  onEdit={() => openEdit(row.habit)}
                  reorder={reorder}
                  canUp={i > 0}
                  canDown={i < rows.length - 1}
                  onMove={(dir) => move(i, dir)}
                />
              ))}
            </ul>
            {!reorder && (
              <Button icon={Plus} block className="mt-5" onClick={() => openNew()}>
                Nuevo hábito
              </Button>
            )}
          </Section>
        </>
      )}

      {archived.length > 0 && (
        <section className="mt-9">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((s) => !s)}
            className="-mx-2 flex min-h-11 items-center gap-2 rounded-control px-2 text-left text-ink-soft hover:text-ink"
          >
            <ChevronDown
              size={18}
              strokeWidth={2.4}
              aria-hidden="true"
              className={cx('transition-transform duration-200', showArchived && 'rotate-180')}
            />
            <span className="type-body font-semibold">Archivados</span>
            <span className="type-small tabular-nums">{archived.length}</span>
          </button>
          {showArchived && (
            <>
              <p className="type-small mt-1 text-ink-soft">Ya no aparecen en tu semana. Su historial sigue guardado.</p>
              <ul className="mt-2 flex flex-col">
                {archived.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                    <span aria-hidden="true" className="w-8 text-center text-xl leading-none grayscale">
                      {h.emoji || '✅'}
                    </span>
                    <span className="type-body min-w-0 flex-1 truncate text-ink-soft">{h.name}</span>
                    <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => restore(h)} className="min-h-11">
                      Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {editor && (
        <HabitEditorSheet
          key={editor.key}
          open
          onClose={() => setEditor(null)}
          habit={editor.habit}
          suggestion={editor.suggestion}
          habits={myHabits}
          onArchive={(h) => setToArchive(h)}
        />
      )}
      <ConfirmDialog
        open={!!toArchive}
        onClose={() => setToArchive(null)}
        title={toArchive ? `¿Archivar ${toArchive.name}?` : ''}
        description="Deja de aparecer en tu semana y en la de la familia. No se borra: su historial se guarda y puedes restaurarlo cuando quieras."
        confirmLabel="Archivar hábito"
        onConfirm={archive}
      />
    </div>
  )
}

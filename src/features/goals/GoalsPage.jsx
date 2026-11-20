import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Target } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useFamily, useGoals } from '../../data/FamilyDataProvider'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Section,
  Surface,
  Toggle,
  memberProps,
} from '../../components/ui'
import GoalItem from './GoalItem'
import GoalDetailSheet from './GoalDetailSheet'
import GoalEditorSheet from './GoalEditorSheet'
import { GOAL_TEMPLATES, favoriteExerciseType } from './goalForm'
import { TemplateList } from './formControls'

/** Metas personales (/metas) — the current user's own goals. */
export default function GoalsPage() {
  const { currentUser } = useAuth()
  const me = currentUser?.id
  const navigate = useNavigate()
  const { members, habits, habitWeeks, workouts, customSports, today, actions } = useFamily()
  const views = useGoals(me, { includeCancelled: true })
  const weeklyGoal = members.find((m) => m.id === me)?.weeklyGoal ?? 3

  const myHabits = useMemo(
    () => habits.filter((h) => h.userId === me && !h.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [habits, me]
  )
  const myWorkouts = useMemo(() => workouts.filter((w) => w.userId === me), [workouts, me])
  const myHabitWeeks = useMemo(() => habitWeeks.filter((hw) => hw.userId === me), [habitWeeks, me])
  const favoriteType = useMemo(() => favoriteExerciseType(myWorkouts), [myWorkouts])

  const [editor, setEditor] = useState(null) // { key, goal?, templateId? }
  const [openId, setOpenId] = useState(null)
  const [toCancel, setToCancel] = useState(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const groups = useMemo(() => {
    const g = { active: [], achieved: [], missed: [], cancelled: [] }
    for (const v of views) g[v.state]?.push(v)
    return g
  }, [views])
  const openView = views.find((v) => v.id === openId) || null
  const visibleCount = groups.active.length + groups.achieved.length + groups.missed.length

  const openNew = (templateId = null) => setEditor({ key: Date.now(), templateId })

  const cancel = async () => {
    try {
      await actions.cancelGoal(toCancel.id)
      setOpenId(null)
      toast('Meta cancelada', { description: 'Ya no aparece en tus metas ni en el feed.' })
    } catch (err) {
      console.error('cancelGoal failed:', err)
      toast.error('No se pudo cancelar la meta. Inténtalo de nuevo.')
    }
  }

  const list = (items, { own = true } = {}) => (
    <Surface padding="lg">
      <ul className="flex flex-col">
        {items.map((v) => (
          <GoalItem key={v.id} view={v} today={today} own={own} onOpen={() => setOpenId(v.id)} />
        ))}
      </ul>
    </Surface>
  )

  return (
    <div {...memberProps(me)} className="pb-6">
      <PageHeader
        back
        title="Tus metas"
        description="Proponte algo con plazo y, si quieres, un premio. No cambian tu racha."
      />

      <div className="mb-9 flex items-center gap-3 rounded-surface bg-surface-sunk py-3 pr-3 pl-4">
        <div className="min-w-0 flex-1">
          <p className="type-body font-semibold text-ink">
            Tu meta semanal: {weeklyGoal} {weeklyGoal === 1 ? 'sesión' : 'sesiones'}
          </p>
          <p className="type-small text-ink-soft">La cambias en tu perfil.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/perfil')} className="-mr-2 min-h-11 shrink-0">
          Cambiar
        </Button>
      </div>

      {visibleCount === 0 && groups.cancelled.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Aún no tienes metas propias"
          description="Elige una plantilla para empezar. Puedes cambiar todo después."
          action={
            <TemplateList
              templates={GOAL_TEMPLATES}
              onPick={(id) => openNew(id)}
              hasHabits={myHabits.length > 0}
              className="w-full"
            />
          }
          className="[&>div:last-child]:w-full"
        />
      ) : (
        <>
          <Section title="Activas">
            {groups.active.length ? (
              list(groups.active)
            ) : (
              <EmptyState compact title="No tienes metas activas" description="¿Te propones la siguiente?" />
            )}
            <Button icon={Plus} block className="mt-5" onClick={() => openNew()}>
              Nueva meta
            </Button>
          </Section>

          {groups.achieved.length > 0 && <Section title="Logradas">{list(groups.achieved)}</Section>}

          {groups.missed.length > 0 && (
            <Section title="No logradas" description="El plazo terminó antes. Lo avanzado cuenta igual.">
              {list(groups.missed)}
            </Section>
          )}

          {groups.cancelled.length > 0 && (
            <div className="mt-9">
              <Toggle
                checked={showCancelled}
                onChange={setShowCancelled}
                label="Mostrar canceladas"
                description={groups.cancelled.length === 1 ? '1 meta cancelada' : `${groups.cancelled.length} metas canceladas`}
              />
              {showCancelled && <div className="mt-3">{list(groups.cancelled)}</div>}
            </div>
          )}
        </>
      )}

      <GoalDetailSheet
        view={openView}
        workouts={myWorkouts}
        habitWeeks={myHabitWeeks}
        onClose={() => setOpenId(null)}
        onEdit={() => {
          setEditor({ key: Date.now(), goal: openView.goal })
          setOpenId(null)
        }}
        onCancel={() => setToCancel(openView.goal)}
      />

      {editor && (
        <GoalEditorSheet
          key={editor.key}
          open
          onClose={() => setEditor(null)}
          goal={editor.goal}
          templateId={editor.templateId}
          habits={myHabits}
          weeklyGoal={weeklyGoal}
          favoriteType={favoriteType}
          customSports={customSports}
        />
      )}

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title="¿Cancelar esta meta?"
        description="Deja de aparecer en tus metas y en el feed. No se borra: puedes verla con «Mostrar canceladas»."
        confirmLabel="Cancelar meta"
        cancelLabel="Volver"
        onConfirm={cancel}
      />
    </div>
  )
}

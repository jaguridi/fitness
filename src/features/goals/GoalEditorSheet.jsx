import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { EXERCISE_TYPES } from '../../constants'
import { useFamily } from '../../data/FamilyDataProvider'
import { Button, Chip, Field, SegmentedControl, Sheet, TextField, cx } from '../../components/ui'
import EmojiPicker from '../habits/EmojiPicker'
import { VISIBILITY_OPTIONS } from '../habits/HabitEditorSheet'
import {
  GOAL_EMOJIS,
  GOAL_REWARD_MAX,
  GOAL_TEMPLATES,
  GOAL_TITLE_MAX,
  PERIOD_PRESETS,
  buildGoalPayload,
  describeGoal,
  formFromGoal,
  formFromTemplate,
  goalUnit,
  updateForm,
  validateGoalForm,
} from './goalForm'
import { DateField, SelectField, TemplateList } from './formControls'

const KIND_OPTIONS = [
  { value: 'auto', label: 'Automática' },
  { value: 'manual', label: 'Manual' },
]
const KIND_HINT = {
  auto: 'Se mide sola con lo que registras en la app.',
  manual: 'Tú vas anotando el avance, como los km o los libros.',
}
const METRIC_OPTIONS = [
  { value: 'sessions', label: 'Sesiones' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'calories', label: 'Calorías' },
  { value: 'habit', label: 'Hábito' },
]
const GOAL_VISIBILITY_HINT = {
  family: 'La familia la ve en el feed y en tu perfil, y puede reaccionar.',
  private: 'Privada: solo tú la ves en la app.',
}

/**
 * GoalEditorSheet — create (from a quick template) or edit a personal goal of
 * the current user. Mount it with a fresh `key` each time it opens.
 *
 *   <GoalEditorSheet key={k} open onClose={close} />                          // starts at the templates
 *   <GoalEditorSheet key={k} open onClose={close} templateId="sessions_month" /> // straight to the form
 *   <GoalEditorSheet key={k} open onClose={close} goal={goalDoc} />            // edit
 *
 * @param {object} [goal]        goal doc to edit
 * @param {string} [templateId]  start a new goal from this template
 * @param {object[]} habits      the user's active habits (habit goals)
 * @param {number} weeklyGoal    the user's weekly sessions goal (template defaults)
 * @param {string} [favoriteType] most frequent exercise type (template defaults)
 * @param {string[]} [customSports]
 */
export default function GoalEditorSheet({ open, onClose, goal = null, templateId = null, habits = [], weeklyGoal = 3, favoriteType, customSports = [] }) {
  const { actions, today } = useFamily()
  const editing = Boolean(goal?.id)
  const ctx = useMemo(() => ({ today, weeklyGoal, habits, favoriteType }), [today, weeklyGoal, habits, favoriteType])
  const [step, setStep] = useState(editing || templateId ? 'form' : 'templates')
  const [form, setForm] = useState(() => (editing ? formFromGoal(goal, today) : formFromTemplate(templateId, ctx)))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (patch) => setForm((f) => updateForm(f, patch, ctx))
  const pick = (id) => {
    setForm(formFromTemplate(id, ctx))
    setSubmitted(false)
    setStep('form')
  }

  const habitName = habits.find((h) => h.id === form.habitId)?.name
  const errors = validateGoalForm(form, { today, isNew: !editing })
  const shown = submitted ? errors : {}
  const sentence = describeGoal(form, { habitName })
  const typeOptions = useMemo(() => {
    const all = [...new Set([...EXERCISE_TYPES.filter((t) => t !== 'Otro'), ...customSports, 'Otro'])]
    if (form.exerciseType && !all.includes(form.exerciseType)) all.unshift(form.exerciseType)
    return [{ value: '', label: 'Cualquier ejercicio' }, ...all.map((t) => ({ value: t, label: t }))]
  }, [customSports, form.exerciseType])

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    try {
      setSaving(true)
      const payload = buildGoalPayload(form, { id: goal?.id })
      if (editing) {
        // Keep the recorded manual progress; it's edited from the goal itself.
        if (payload.kind === 'manual') payload.progress = goal.kind === 'manual' ? Number(goal.progress) || 0 : 0
      } else {
        for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k]
      }
      await actions.saveGoal(payload)
      toast.success(editing ? 'Meta guardada' : 'Meta creada', {
        description: editing ? undefined : form.visibility === 'family' ? 'La familia la verá en el feed.' : 'Solo tú la ves.',
      })
      onClose()
    } catch (err) {
      console.error('saveGoal failed:', err)
      toast.error(err?.message && /fecha|título|objetivo/i.test(err.message) ? err.message : 'No se pudo guardar la meta. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'templates') {
    return (
      <Sheet open={open} onClose={onClose} title="Nueva meta" description="Elige por dónde empezar. Después puedes cambiar todo.">
        <TemplateList templates={GOAL_TEMPLATES} onPick={pick} hasHabits={habits.length > 0} />
      </Sheet>
    )
  }

  const isAuto = form.kind === 'auto'
  const unitWord = isAuto ? goalUnit(form, Number(form.target) || 2) : ''

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Editar meta' : 'Nueva meta'}
      footer={
        <div>
          <p className="type-small mb-3 text-ink-soft" aria-live="polite">
            <span className="font-semibold text-ink">{form.emoji} </span>
            {sentence}
          </p>
          <Button block size="lg" onClick={save} loading={saving}>
            Guardar meta
          </Button>
        </div>
      }
    >
      {!editing && (
        <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setStep('templates')} className="-ml-2 mb-3">
          Otras plantillas
        </Button>
      )}
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField
          label="Título"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={isAuto ? '12 sesiones en diciembre' : 'Correr 100 km'}
          maxLength={GOAL_TITLE_MAX + 10}
          autoComplete="off"
          error={shown.title}
          hint={isAuto && !form.titleTouched ? 'Lo armamos con lo que elijas; cámbialo si quieres.' : undefined}
        />

        <Field label="Emoji">
          <EmojiPicker value={form.emoji} onChange={(emoji) => set({ emoji })} options={GOAL_EMOJIS} label="Emoji de la meta" />
        </Field>

        <div>
          <p className="type-small mb-2 font-semibold text-ink">Cómo se mide</p>
          <SegmentedControl label="Cómo se mide" value={form.kind} onChange={(kind) => set({ kind })} options={KIND_OPTIONS} />
          <p className="type-small mt-2 text-ink-soft">{KIND_HINT[form.kind]}</p>
        </div>

        {isAuto && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="type-small mb-2 font-semibold text-ink">Qué cuenta</p>
              <SegmentedControl
                label="Qué cuenta"
                value={form.metric}
                onChange={(metric) => set({ metric, ...(metric === 'habit' && !form.habitId && habits[0] ? { habitId: habits[0].id } : {}) })}
                options={METRIC_OPTIONS}
                className="[&_button]:px-1.5"
              />
            </div>
            {form.metric === 'habit' ? (
              habits.length ? (
                <SelectField
                  label="Hábito"
                  value={form.habitId}
                  onChange={(habitId) => set({ habitId })}
                  error={shown.habitId}
                  options={[
                    ...(form.habitId ? [] : [{ value: '', label: 'Elige un hábito' }]),
                    ...habits.map((h) => ({ value: h.id, label: `${h.emoji || '✅'} ${h.name}` })),
                  ]}
                  hint="Cuenta cada día que lo marques dentro del plazo."
                />
              ) : (
                <p className="type-small rounded-control bg-surface-sunk p-3 text-ink-soft">
                  Aún no tienes hábitos. Crea uno en Hábitos y vuelve a elegir esta opción.
                </p>
              )
            ) : (
              <SelectField
                label="Ejercicio"
                value={form.exerciseType}
                onChange={(exerciseType) => set({ exerciseType })}
                options={typeOptions}
                hint={
                  form.metric === 'calories'
                    ? 'Solo suman las sesiones en que anotaste calorías.'
                    : form.exerciseType
                      ? `Solo cuentan las sesiones que incluyen ${form.exerciseType}.`
                      : 'Cuenta cualquier sesión que registres.'
                }
              />
            )}
          </div>
        )}

        <div className={cx('grid gap-3', isAuto ? 'grid-cols-1' : 'grid-cols-2')}>
          <Field label="Objetivo" error={shown.target}>
            <div className="relative">
              <input
                type="text"
                inputMode={isAuto ? 'numeric' : 'decimal'}
                value={form.target}
                onChange={(e) => set({ target: e.target.value.replace(/[^\d.,]/g, '') })}
                placeholder={isAuto ? '12' : '100'}
                aria-invalid={shown.target ? true : undefined}
                className={cx(
                  'h-12 w-full rounded-control border bg-surface px-4 text-base tabular-nums text-ink placeholder:text-ink-faint',
                  'focus:outline-none focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]',
                  shown.target ? 'border-danger' : 'border-line-strong',
                  unitWord && 'pr-24'
                )}
              />
              {unitWord && (
                <span className="type-small pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-soft">{unitWord}</span>
              )}
            </div>
          </Field>
          {!isAuto && (
            <TextField
              label="Unidad"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="km, libros…"
              hint="Opcional"
              error={shown.unit}
              autoComplete="off"
            />
          )}
        </div>

        <div>
          <p className="type-small mb-2 font-semibold text-ink">Plazo</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Plazo">
            {PERIOD_PRESETS.map((p) => (
              <Chip key={p.id} size="sm" selected={form.period === p.id} onClick={() => set({ period: p.id })}>
                {p.label}
              </Chip>
            ))}
          </div>
          {form.period === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <DateField label="Inicio" value={form.startDate} onChange={(startDate) => set({ startDate })} error={shown.dates} />
              <DateField
                label="Término"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(endDate) => set({ endDate })}
                error={shown.dates}
              />
            </div>
          )}
          {shown.dates && <p className="type-small mt-2 text-danger">{shown.dates}</p>}
        </div>

        <TextField
          label="Si lo logro…"
          value={form.reward}
          onChange={(e) => set({ reward: e.target.value })}
          placeholder="me compro unas zapatillas nuevas"
          maxLength={GOAL_REWARD_MAX + 10}
          hint="Opcional. Tu premio, si quieres ponerte uno."
          error={shown.reward}
          autoComplete="off"
        />

        <div>
          <p className="type-small mb-2 font-semibold text-ink">Quién la ve</p>
          <SegmentedControl
            label="Quién la ve"
            value={form.visibility}
            onChange={(visibility) => set({ visibility })}
            options={VISIBILITY_OPTIONS}
          />
          <p className="type-small mt-2 text-ink-soft">{GOAL_VISIBILITY_HINT[form.visibility]}</p>
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}

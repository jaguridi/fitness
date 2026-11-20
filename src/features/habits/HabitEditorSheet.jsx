import { useState } from 'react'
import { toast } from 'sonner'
import { Archive, Lock, Users } from 'lucide-react'
import { HABIT_SUGGESTIONS } from '../../constants'
import { useFamily } from '../../data/FamilyDataProvider'
import { Button, Chip, Field, SegmentedControl, Sheet, Stepper, TextField } from '../../components/ui'
import EmojiPicker from './EmojiPicker'
import {
  HABIT_EMOJIS,
  HABIT_NAME_MAX,
  availableSuggestions,
  buildHabitPayload,
  emptyHabitForm,
  habitFormFromHabit,
  habitTargetLabel,
  validateHabitForm,
} from './habitForm'

export const VISIBILITY_OPTIONS = [
  { value: 'family', label: 'La familia', icon: Users },
  { value: 'private', label: 'Solo yo', icon: Lock },
]

export const VISIBILITY_HINT = {
  family: 'La familia lo ve en tu perfil y en el resultado de la semana.',
  private: 'Privado: solo tú lo ves en la app.',
}

/**
 * HabitEditorSheet — create or edit a habit of the current user.
 * Mount it with a fresh `key` each time it opens so the form resets.
 *
 *   <HabitEditorSheet key={k} open onClose={close} habits={myHabits} />                 // new
 *   <HabitEditorSheet key={k} open onClose={close} habit={h} habits={myHabits}
 *     onArchive={(h) => askArchive(h)} />                                                // edit
 *   <HabitEditorSheet key={k} open onClose={close} suggestion={HABIT_SUGGESTIONS[0]} />  // prefilled
 *
 * @param {boolean} open
 * @param {()=>void} onClose
 * @param {object} [habit]       the habit doc when editing
 * @param {object} [suggestion]  a HABIT_SUGGESTIONS entry to prefill a new habit
 * @param {object[]} [habits]    the user's habits (duplicate names, hide taken suggestions)
 * @param {(habit:object)=>void} [onArchive] shows "Archivar hábito" when editing
 */
export default function HabitEditorSheet({ open, onClose, habit = null, suggestion = null, habits = [], onArchive }) {
  const { actions } = useFamily()
  const editing = Boolean(habit?.id)
  const [form, setForm] = useState(() => (editing ? habitFormFromHabit(habit) : emptyHabitForm(suggestion)))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = validateHabitForm(form, { habits, editingId: habit?.id })
  const shownErrors = submitted ? errors : {}
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const ideas = editing ? [] : availableSuggestions(HABIT_SUGGESTIONS, habits)

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    try {
      setSaving(true)
      await actions.saveHabit(buildHabitPayload(form, habit?.id))
      toast.success(editing ? 'Hábito guardado' : 'Hábito creado', {
        description: editing ? undefined : 'Márcalo con un toque cada día que lo cumplas.',
      })
      onClose()
    } catch (err) {
      console.error('saveHabit failed:', err)
      toast.error('No se pudo guardar el hábito. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar hábito' : 'Nuevo hábito'}
      description={editing ? undefined : 'Elige algo chico que quieras sostener cada semana.'}
      footer={
        <Button block size="lg" onClick={save} loading={saving}>
          Guardar hábito
        </Button>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {ideas.length > 0 && (
          <div>
            <p className="type-small mb-2 font-semibold text-ink">Ideas para empezar</p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {ideas.map((s) => (
                <Chip
                  key={s.name}
                  emoji={s.emoji}
                  selected={form.name === s.name && form.emoji === s.emoji}
                  onClick={() => set({ name: s.name, emoji: s.emoji, targetPerWeek: s.targetPerWeek })}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <TextField
          label="Nombre"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Leer 20 minutos"
          maxLength={HABIT_NAME_MAX + 10}
          autoComplete="off"
          enterKeyHint="done"
          error={shownErrors.name}
        />

        <Field label="Emoji">
          <EmojiPicker
            value={form.emoji}
            onChange={(emoji) => set({ emoji })}
            options={HABIT_EMOJIS}
            label="Emoji del hábito"
            error={shownErrors.emoji}
          />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="type-small font-semibold text-ink">Días por semana</p>
            <p className="type-small mt-0.5 text-ink-soft">
              {form.targetPerWeek === 7 ? 'Todos los días.' : `${habitTargetLabel(form.targetPerWeek)}, los que tú elijas.`}
            </p>
          </div>
          <Stepper
            value={form.targetPerWeek}
            onChange={(targetPerWeek) => set({ targetPerWeek })}
            min={1}
            max={7}
            label="Días por semana"
            unit={(n) => (n === 1 ? 'día' : 'días')}
          />
        </div>

        <div>
          <p className="type-small mb-2 font-semibold text-ink">Quién lo ve</p>
          <SegmentedControl
            label="Quién lo ve"
            value={form.visibility}
            onChange={(visibility) => set({ visibility })}
            options={VISIBILITY_OPTIONS}
          />
          <p className="type-small mt-2 text-ink-soft">{VISIBILITY_HINT[form.visibility]}</p>
        </div>

        {editing && onArchive && (
          <div className="border-t border-line pt-4">
            <Button variant="danger-quiet" icon={Archive} onClick={() => onArchive(habit)} className="-ml-3">
              Archivar hábito
            </Button>
            <p className="type-small mt-1 text-ink-soft">Deja de aparecer en tu semana. Su historial se guarda.</p>
          </div>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}

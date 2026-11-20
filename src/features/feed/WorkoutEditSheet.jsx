import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button, Chip, ConfirmDialog, Field, Sheet, TextArea, TextField } from '../../components/ui'
import { EXERCISE_TYPES, getExerciseTypes } from '../../constants'
import { useFamily } from '../../data/FamilyDataProvider'

/**
 * Edit or delete one of your workouts (only within 24 h of logging it — the
 * caller checks canEditWorkout). Photo and date can't change: they anchor the
 * week it counts for.
 *
 *   <WorkoutEditSheet workout={w} open={editing} onClose={() => setEditing(false)} />
 */
export default function WorkoutEditSheet({ workout, open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Editar ejercicio" description="La foto y la fecha no se pueden cambiar.">
      {open && workout && <EditForm workout={workout} onClose={onClose} />}
    </Sheet>
  )
}

function EditForm({ workout, onClose }) {
  const { actions, customSports } = useFamily()
  const [types, setTypes] = useState(() => getExerciseTypes(workout))
  const [duration, setDuration] = useState(String(workout.duration || ''))
  const [calories, setCalories] = useState(workout.calories ? String(workout.calories) : '')
  const [description, setDescription] = useState(workout.description || '')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const options = [...new Set([...EXERCISE_TYPES.filter((t) => t !== 'Otro'), ...(customSports || []), ...getExerciseTypes(workout), 'Otro'])]
  const toggle = (t) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const save = async (e) => {
    e?.preventDefault()
    const mins = parseInt(duration, 10)
    const cal = calories.trim() ? parseInt(calories, 10) : 0
    const next = {}
    if (!types.length) next.types = 'Elige al menos un tipo de ejercicio.'
    if (!(mins > 0) || mins > 600) next.duration = 'Escribe cuántos minutos entrenaste (de 1 a 600).'
    if (calories.trim() && !(cal >= 0)) next.calories = 'Escribe un número de calorías o déjalo vacío.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await actions.updateWorkout(workout.id, {
        exerciseType: types,
        duration: mins,
        description: description.trim(),
        // null clears a previously set value
        calories: cal > 0 ? cal : null,
      })
      toast.success('Ejercicio actualizado')
      onClose()
    } catch (err) {
      console.error('updateWorkout failed:', err)
      toast.error('No se pudo guardar el cambio. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await actions.deleteWorkout(workout.id)
      toast.success('Ejercicio eliminado')
      onClose()
    } catch (err) {
      console.error('deleteWorkout failed:', err)
      toast.error('No se pudo eliminar el ejercicio. Inténtalo de nuevo.')
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <Field label="Tipo de ejercicio" error={errors.types}>
        <div className="flex flex-wrap gap-2" role="group">
          {options.map((t) => (
            <Chip key={t} size="sm" selected={types.includes(t)} onClick={() => toggle(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Minutos"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 3))}
          error={errors.duration}
        />
        <TextField
          label="Calorías"
          inputMode="numeric"
          hint="Opcional"
          value={calories}
          onChange={(e) => setCalories(e.target.value.replace(/\D/g, '').slice(0, 5))}
          error={errors.calories}
        />
      </div>
      <TextArea
        label="Comentario"
        hint="Opcional. Lo ve toda la familia."
        value={description}
        maxLength={280}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="¿Cómo te fue?"
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" block loading={saving}>
          Guardar cambios
        </Button>
        <Button variant="danger-quiet" icon={Trash2} block onClick={() => setConfirmDelete(true)} disabled={saving}>
          Eliminar ejercicio
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar este ejercicio?"
        description="Se quita del feed y de tu semana, junto con sus reacciones y comentarios. No se puede deshacer."
        confirmLabel="Eliminar ejercicio"
        tone="danger"
        onConfirm={remove}
      />
    </form>
  )
}

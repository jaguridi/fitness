import { useCallback, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays, CircleAlert } from 'lucide-react'
import { Button, Chip, Field, Sheet, TextArea, TextField, cx, inputClass } from '../../components/ui'
import { useFamily, useMemberWeek } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'
import { EXERCISE_TYPES } from '../../constants'
import { addDaysYMD, weekIdOfDate } from '../../game/habits.js'
import { getPreviousWeekId } from '../../game/weekId.js'
import { formatWeekLabel } from '../../utils/dates'
import { describeUploadError } from '../../utils/uploadErrors'
import { useLogSheet } from './LogSheetContext'
import ExerciseTypePicker from './ExerciseTypePicker'
import PhotoField, { usePhotoField } from './PhotoField'
import WeekCelebration from './WeekCelebration'
import {
  DURATION_PRESETS,
  MAX_CALORIES,
  MAX_DURATION,
  getLogCelebration,
  initialValues,
  orderExerciseTypes,
  parseIntField,
  successDescription,
  validateLog,
} from './logForm'

/**
 * Hoja "Registrar ejercicio". Se monta una sola vez en App; se abre con
 * useLogSheet().openLog(initial). El formulario se arma de nuevo en cada apertura
 * con los valores iniciales que se pasen ({ date, exerciseType, duration, … }).
 * Si el ejercicio logra la semana actual (o la supera) muestra <WeekCelebration>.
 */
export default function LogSheet() {
  const { open, initial, closeLog } = useLogSheet()
  const [celebration, setCelebration] = useState(null)
  const closeCelebration = useCallback(() => setCelebration(null), [])
  return (
    <>
      {open && <LogSheetBody initial={initial} onClose={closeLog} onCelebrate={setCelebration} />}
      {celebration && <WeekCelebration {...celebration} onClose={closeCelebration} />}
    </>
  )
}

function LogSheetBody({ initial, onClose, onCelebrate }) {
  const { today, weekId, customSports, workouts, actions } = useFamily()
  const { currentUser } = useAuth()
  const userId = currentUser?.id
  const week = useMemberWeek(userId)
  const formId = useId()

  const [init] = useState(() => initialValues(initial, today))
  const [date, setDate] = useState(init.date)
  const [types, setTypes] = useState(init.types)
  const [duration, setDuration] = useState(init.duration)
  const [calories, setCalories] = useState(init.calories)
  const [description, setDescription] = useState(init.description)
  const yesterday = addDaysYMD(today, -1)
  const [pickDate, setPickDate] = useState(init.date !== today && init.date !== yesterday)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const photo = usePhotoField(date)

  const myWorkouts = useMemo(() => workouts.filter((w) => w.userId === userId), [workouts, userId])
  const allTypes = useMemo(() => {
    const ordered = orderExerciseTypes(EXERCISE_TYPES, customSports, myWorkouts)
    // Tipos iniciales que no estén en el catálogo (p. ej. un deporte antiguo) también se muestran.
    return [...ordered, ...types.filter((t) => !ordered.includes(t))]
  }, [customSports, myWorkouts, types])

  const v = validateLog({
    date,
    today,
    types,
    duration,
    calories,
    hasPhoto: Boolean(photo.file),
    photoBlocked: photo.blocked,
    processingPhoto: photo.processing,
  })

  const workoutWeek = date ? weekIdOfDate(date) : weekId
  const weekHint =
    workoutWeek === weekId
      ? null
      : workoutWeek === getPreviousWeekId(weekId)
        ? 'Cuenta para la semana pasada, no para esta.'
        : `Cuenta para la semana del ${formatWeekLabel(workoutWeek)}.`

  const submit = async (e) => {
    e?.preventDefault()
    setAttempted(true)
    if (!v.canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const before = { sessions: week.sessions, goal: week.goal }
    const cal = parseIntField(calories)
    try {
      await actions.logWorkout({
        date,
        exerciseType: types,
        duration: parseIntField(duration),
        calories: cal || undefined,
        description: description.trim(),
        photo: photo.file,
      })
      const celebration = getLogCelebration(before, date, weekId)
      onClose()
      if (celebration) {
        onCelebrate({ ...celebration, userId })
      } else {
        toast.success('Ejercicio registrado', {
          description: successDescription({ sessions: before.sessions + 1, goal: before.goal, date, today, currentWeekId: weekId }),
        })
      }
    } catch (err) {
      console.error('logWorkout failed:', err)
      setSubmitError(describeUploadError(err))
      setSubmitting(false)
    }
  }

  const durationNum = parseIntField(duration)

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Registrar ejercicio"
      description="Cuéntale a la familia qué hiciste."
      footer={
        <div className="flex flex-col gap-2">
          {submitError && (
            <p role="alert" className="type-small flex items-start gap-2 text-danger">
              <CircleAlert size={17} strokeWidth={2.3} className="mt-px shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </p>
          )}
          {!submitError && v.missingText && (
            <p className={cx('type-small', attempted ? 'text-danger' : 'text-ink-soft')} aria-live="polite">
              {v.missingText}
            </p>
          )}
          {!submitError && !v.missingText && photo.blocked && (
            <p className="type-small text-danger">La fecha de la foto no coincide con la del ejercicio.</p>
          )}
          <Button type="submit" form={formId} block size="lg" loading={submitting} disabled={!v.canSubmit}>
            {submitting ? 'Registrando…' : 'Registrar ejercicio'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="type-small mb-1.5 font-semibold text-ink">Fecha</legend>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={!pickDate && date === today}
              onClick={() => {
                setPickDate(false)
                setDate(today)
              }}
              disabled={submitting}
            >
              Hoy
            </Chip>
            <Chip
              selected={!pickDate && date === yesterday}
              onClick={() => {
                setPickDate(false)
                setDate(yesterday)
              }}
              disabled={submitting}
            >
              Ayer
            </Chip>
            <Chip icon={CalendarDays} selected={pickDate} onClick={() => setPickDate(true)} disabled={submitting}>
              Otro día
            </Chip>
          </div>
          {pickDate && (
            <Field label="Día del ejercicio" error={v.errors.date} hint={weekHint} className="mt-1">
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className={cx(inputClass(v.errors.date), 'h-12')}
                disabled={submitting}
              />
            </Field>
          )}
          {!pickDate && weekHint && <p className="type-small text-ink-soft">{weekHint}</p>}
        </fieldset>

        <ExerciseTypePicker
          types={allTypes}
          selected={types}
          onChange={setTypes}
          onAddCustom={actions.addCustomSport}
          disabled={submitting}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="type-small mb-1.5 font-semibold text-ink">Minutos</legend>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((m) => (
              <Chip
                key={m}
                selected={durationNum === m}
                onClick={() => setDuration(String(m))}
                className="tabular-nums"
                disabled={submitting}
              >
                {m}
              </Chip>
            ))}
          </div>
          <TextField
            label="Minutos exactos"
            className="mt-1 [&>label]:sr-only"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="O escribe los minutos exactos"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            error={v.errors.duration}
            hint={`Entre 1 y ${MAX_DURATION}.`}
            disabled={submitting}
          />
        </fieldset>

        <PhotoField photo={photo} date={date} today={today} showMissing={attempted && !photo.file} disabled={submitting} />

        <TextField
          label="Calorías"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Por ejemplo, 350"
          value={calories}
          onChange={(e) => setCalories(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
          error={v.errors.calories}
          hint={`Opcional, hasta ${MAX_CALORIES.toLocaleString('es-CL')}.`}
          disabled={submitting}
        />

        <TextArea
          label="Descripción"
          placeholder="¿Cómo te fue?"
          hint="Opcional. La ve toda la familia."
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
        />
      </form>
    </Sheet>
  )
}

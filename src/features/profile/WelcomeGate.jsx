import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Check, Flame, HandCoins, Moon, Sparkles } from 'lucide-react'
import { Button, Chip, Sheet, Stepper, cx } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { useFamily } from '../../data/FamilyDataProvider'
import { HABIT_SUGGESTIONS } from '../../constants'

/**
 * Bienvenida a la v2: se muestra una vez por persona y dispositivo
 * (localStorage `fitfamily_welcome_v2_<userId>`), cuando los datos están listos,
 * no hay otra capa abierta (celebración de lámina, registrar ejercicio…) y la
 * persona lleva un momento sin tocar nada. Tres pasos breves, todos saltables.
 */
export const welcomeKey = (userId) => `fitfamily_welcome_v2_${userId}`

function readSeen(userId) {
  try {
    return localStorage.getItem(welcomeKey(userId)) === '1'
  } catch {
    return false // modo privado: sin memoria, pero tampoco molestamos (ver abajo)
  }
}

function markSeen(userId) {
  try {
    localStorage.setItem(welcomeKey(userId), '1')
  } catch {
    /* modo privado */
  }
}

const otherLayerOpen = () => !!document.querySelector('[role="dialog"], [role="alertdialog"]')

const FIRST_DELAY_MS = 2500
const IDLE_MS = 1500
const plural = (n, one, many) => (n === 1 ? one : many)

function Steps({ step }) {
  return (
    <div aria-hidden="true" className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cx('h-1.5 rounded-full transition-all duration-300', i === step ? 'w-6 bg-ink' : 'w-1.5 bg-line-strong')} />
      ))}
    </div>
  )
}

function Point({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
        <Icon size={16} strokeWidth={2.3} />
      </span>
      <span className="type-body text-ink-soft">{children}</span>
    </li>
  )
}

export default function WelcomeGate() {
  const { currentUser } = useAuth()
  const { ready, members, habits, actions } = useFamily()
  const userId = currentUser?.id
  const member = members.find((m) => m.id === userId)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(3)
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)
  const lastInput = useRef(Date.now())

  // Esperar: datos listos, sin otra capa abierta y la persona quieta un momento.
  useEffect(() => {
    if (!ready || !userId || open || readSeen(userId)) return undefined
    let storageWorks = true
    try {
      localStorage.setItem('fitfamily_probe', '1')
      localStorage.removeItem('fitfamily_probe')
    } catch {
      storageWorks = false
    }
    // Sin localStorage la mostraríamos en cada visita: mejor no mostrarla.
    if (!storageWorks) return undefined

    const onInput = () => {
      lastInput.current = Date.now()
    }
    window.addEventListener('pointerdown', onInput, true)
    window.addEventListener('keydown', onInput, true)
    window.addEventListener('scroll', onInput, { passive: true, capture: true })
    const start = Date.now()
    const id = setInterval(() => {
      if (Date.now() - start < FIRST_DELAY_MS) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastInput.current < IDLE_MS) return
      if (otherLayerOpen()) return
      setOpen(true)
    }, 500)
    return () => {
      clearInterval(id)
      window.removeEventListener('pointerdown', onInput, true)
      window.removeEventListener('keydown', onInput, true)
      window.removeEventListener('scroll', onInput, { capture: true })
    }
  }, [ready, userId, open])

  // Al abrir, partir del estado real.
  useEffect(() => {
    if (open) {
      setStep(0)
      setGoal(member?.weeklyGoal ?? 3)
      setPicked([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const suggestions = useMemo(() => {
    const mine = new Set(habits.filter((h) => h.userId === userId && !h.archived).map((h) => (h.name || '').trim().toLowerCase()))
    return HABIT_SUGGESTIONS.filter((s) => !mine.has(s.name.toLowerCase()))
  }, [habits, userId])

  const close = () => {
    markSeen(userId)
    setOpen(false)
  }

  const saveGoalAndNext = async () => {
    if (goal !== member?.weeklyGoal) {
      setSaving(true)
      try {
        await actions.setWeeklyGoal(goal)
      } catch (err) {
        toast.error(err?.message || 'No se pudo guardar la meta. Puedes cambiarla después en Perfil.')
      } finally {
        setSaving(false)
      }
    }
    setStep(2)
  }

  const finish = async () => {
    if (picked.length) {
      setSaving(true)
      let ok = 0
      for (const name of picked) {
        const s = HABIT_SUGGESTIONS.find((x) => x.name === name)
        if (!s) continue
        try {
          await actions.saveHabit({ name: s.name, emoji: s.emoji, targetPerWeek: s.targetPerWeek, visibility: 'family' })
          ok++
        } catch (err) {
          console.error('saveHabit failed:', err)
        }
      }
      setSaving(false)
      if (ok) toast.success(ok === 1 ? 'Hábito creado' : `${ok} hábitos creados`, { description: 'Los marcas con un toque en Hoy.' })
      if (ok < picked.length) toast.error('Algunos hábitos no se guardaron. Puedes crearlos en Hábitos.')
    }
    close()
  }

  const toggle = (name) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))

  if (!open) return null

  const titles = ['Empieza la temporada 2', '¿Cuántas sesiones por semana?', 'Elige tus primeros hábitos']
  const descriptions = [
    `Hola, ${member?.name || currentUser?.name || ''}. Esto es lo que cambió.`,
    'Tu meta semanal es tuya. La semana se logra al llegar a ella.',
    'Opcional. Se marcan con un toque y la familia los ve.',
  ]

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <Steps step={step} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={close} disabled={saving}>
          {step === 2 ? 'Ahora no' : 'Saltar'}
        </Button>
        {step === 0 && <Button onClick={() => setStep(1)}>Siguiente</Button>}
        {step === 1 && (
          <Button onClick={saveGoalAndNext} loading={saving}>
            Guardar meta
          </Button>
        )}
        {step === 2 && (
          <Button onClick={finish} loading={saving} icon={picked.length ? Check : undefined}>
            {picked.length ? `Crear ${picked.length} ${plural(picked.length, 'hábito', 'hábitos')}` : 'Empezar'}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Sheet open={open} onClose={close} title={titles[step]} description={descriptions[step]} footer={footer}>
      <p className="sr-only" aria-live="polite">
        Paso {step + 1} de 3
      </p>

      {step === 0 && (
        <ul className="flex flex-col gap-4">
          <Point icon={HandCoins}>
            <strong className="font-semibold text-ink">Se acabaron las multas.</strong> Nada de pozo, vidas ni escudos. Si una
            semana no sale, la siguiente parte de cero.
          </Point>
          <Point icon={Flame}>Cada uno elige su meta semanal y suma una racha de semanas logradas.</Point>
          <Point icon={Moon}>Si necesitas parar, marca una semana de descanso: no suma ni rompe la racha.</Point>
          <Point icon={Camera}>
            Se mantiene lo de siempre: la foto obligatoria, las reacciones, los comentarios y los empujones.
          </Point>
          <Point icon={Sparkles}>Lo nuevo: hábitos, metas propias con recompensa y un álbum de láminas.</Point>
        </ul>
      )}

      {step === 1 && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Stepper value={goal} onChange={setGoal} min={1} max={7} label="Meta semanal" unit={(n) => plural(n, 'sesión por semana', 'sesiones por semana')} />
          <p className="type-small max-w-[32ch] text-center text-ink-soft">
            Aplica desde esta semana. Puedes cambiarla cuando quieras en Perfil.
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          {suggestions.length ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hábitos sugeridos">
              {suggestions.map((s) => (
                <Chip key={s.name} emoji={s.emoji} selected={picked.includes(s.name)} onClick={() => toggle(s.name)}>
                  {s.name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="type-body text-ink-soft">Ya tienes todos los hábitos sugeridos. Puedes crear otros en Hábitos.</p>
          )}
          <p className="type-small mt-4 text-ink-soft">
            Después puedes cambiar los días por semana, hacerlos privados o crear los tuyos en Perfil, Mis hábitos.
          </p>
        </div>
      )}
    </Sheet>
  )
}

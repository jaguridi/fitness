import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Archive, Bell, BellOff, ChartColumn, ChevronRight, Flame, Info, ListChecks, LogOut, Sparkles, Target, UserRound,
} from 'lucide-react'
import {
  AvatarRing, Button, ConfirmDialog, SegmentedControl, Section, Stepper, Surface, Toggle, THEME_OPTIONS, cx, memberProps, useTheme,
} from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { useAlbumSummary, useFamily, useMemberWeek } from '../../data/FamilyDataProvider'
import { getNextWeekId } from '../../game/weekId'
import { formatWeekLabel } from '../../utils/dates'
import { version } from '../../../package.json'

const plural = (n, one, many) => (n === 1 ? one : many)

/** Estado de las notificaciones del navegador en este dispositivo. */
function readPushSupport() {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

function ShortcutRow({ to, icon: Icon, title, description }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={to}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-control px-2 py-2.5 transition-colors duration-150 hover:bg-ink/4"
      >
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-body block font-semibold text-ink">{title}</span>
          {description && <span className="type-small block truncate text-ink-soft">{description}</span>}
        </span>
        <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="shrink-0 text-ink-faint" />
      </Link>
    </li>
  )
}

function WeeklyGoalControl({ member, actions }) {
  const [goal, setGoal] = useState(member.weeklyGoal)
  const pending = useRef(null)
  useEffect(() => {
    if (!pending.current) setGoal(member.weeklyGoal)
  }, [member.weeklyGoal])
  useEffect(() => () => clearTimeout(pending.current), [])

  const change = (n) => {
    setGoal(n)
    clearTimeout(pending.current)
    pending.current = setTimeout(async () => {
      pending.current = null
      try {
        await actions.setWeeklyGoal(n)
        toast.success('Meta semanal guardada', { description: `${n} ${plural(n, 'sesión', 'sesiones')} por semana, desde esta semana.` })
      } catch (err) {
        setGoal(member.weeklyGoal)
        toast.error(err?.message || 'No se pudo guardar la meta. Inténtalo de nuevo.')
      }
    }, 600)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="type-body font-semibold text-ink">Meta semanal</p>
          <p className="type-small mt-0.5 text-ink-soft">Sesiones para lograr la semana</p>
        </div>
        <Stepper value={goal} onChange={change} min={1} max={7} label="Meta semanal" unit={(n) => plural(n, 'sesión', 'sesiones')} />
      </div>
      <p className="type-small mt-3 text-ink-soft">
        Un cambio se aplica de inmediato, también a la semana en curso. Las semanas ya cerradas no cambian.
      </p>
    </div>
  )
}

function RestWeekToggles({ member, weekId, actions }) {
  const nextWeekId = getNextWeekId(weekId)
  const [busy, setBusy] = useState(null)
  const rest = new Set(member.restWeeks || [])
  const set = async (id, on, label) => {
    setBusy(id)
    try {
      await actions.setRestWeek(id, on)
      toast(on ? `${label}: semana de descanso` : `${label}: vuelve a contar`, {
        description: on ? 'No suma ni rompe tu racha.' : `Tu meta de ${member.weeklyGoal} ${plural(member.weeklyGoal, 'sesión', 'sesiones')} vuelve a aplicar.`,
      })
    } catch (err) {
      toast.error(err?.message || 'No se pudo cambiar. Inténtalo de nuevo.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div>
      <Toggle
        checked={rest.has(weekId)}
        disabled={busy === weekId}
        onChange={(on) => set(weekId, on, 'Esta semana')}
        label="Descanso esta semana"
        description={formatWeekLabel(weekId)}
      />
      <Toggle
        checked={rest.has(nextWeekId)}
        disabled={busy === nextWeekId}
        onChange={(on) => set(nextWeekId, on, 'La próxima semana')}
        label="Descanso la próxima semana"
        description={formatWeekLabel(nextWeekId)}
      />
    </div>
  )
}

function NotificationsControl({ isDemo, isReadonly, actions }) {
  const [support, setSupport] = useState(readPushSupport)
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    const refresh = () => setSupport(readPushSupport())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const token = await actions.registerPush()
      setSupport(readPushSupport())
      if (token) {
        setRegistered(true)
        toast.success('Notificaciones activadas', {
          description: isDemo ? 'Modo demo: no se envía nada de verdad.' : 'Te avisaremos de tu semana y de lo que hace la familia.',
        })
      } else if (readPushSupport() === 'denied') {
        toast('Las notificaciones quedaron bloqueadas', { description: 'Puedes permitirlas en los ajustes del navegador.' })
      } else if (isReadonly) {
        toast('Modo solo lectura: no se guardó nada.')
      } else {
        toast.error('No se pudieron activar ahora. Inténtalo de nuevo en un rato.')
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudieron activar ahora. Inténtalo de nuevo en un rato.')
    } finally {
      setBusy(false)
    }
  }

  let icon = Bell
  let title = 'Notificaciones en este dispositivo'
  let text = 'Avisos de tu semana, del recordatorio de hábitos y de lo que hace la familia.'
  let action = (
    <Button variant="secondary" size="sm" loading={busy} onClick={enable}>
      Activar notificaciones
    </Button>
  )
  if (support === 'unsupported') {
    icon = BellOff
    text = isIOS()
      ? 'En iPhone solo funcionan con la app instalada: en Safari toca Compartir, luego "Agregar a pantalla de inicio", y abre FitFamily desde ese ícono.'
      : 'Este navegador no permite notificaciones. Prueba con Chrome, Edge o Safari actualizados.'
    action = null
  } else if (support === 'denied') {
    icon = BellOff
    text = 'Están bloqueadas para esta página. Para recibirlas, permite las notificaciones de FitFamily en los ajustes del navegador o del teléfono y vuelve aquí.'
    action = null
  } else if (support === 'granted') {
    title = 'Notificaciones activadas'
    text = registered
      ? 'Este dispositivo quedó registrado.'
      : 'Este dispositivo tiene permiso. Si no te llegan, vuelve a registrarlo.'
    action = (
      <Button variant="ghost" size="sm" loading={busy} onClick={enable}>
        Volver a registrar
      </Button>
    )
  }
  const Icon = icon

  return (
    <div className="flex items-start gap-3 py-1.5">
      <span aria-hidden="true" className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body font-medium text-ink">{title}</p>
        <p className="type-small mt-0.5 text-ink-soft">{text}</p>
        {action && <div className="mt-2.5 -ml-0.5">{action}</div>}
      </div>
    </div>
  )
}

/** Perfil: tu meta, tu descanso, tus atajos y tus ajustes. */
export default function ProfilePage() {
  const { currentUser, logout } = useAuth()
  const { members, weekId, actions, isDemo, isReadonly } = useFamily()
  const me = currentUser?.id
  const member = members.find((m) => m.id === me) || { id: me, name: currentUser?.name, weeklyGoal: 3, restWeeks: [], prefs: {} }
  const week = useMemberWeek(me)
  const album = useAlbumSummary(me)
  const { preference, setPreference } = useTheme()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [reminder, setReminder] = useState(member.prefs?.habitReminder !== false)
  useEffect(() => setReminder(member.prefs?.habitReminder !== false), [member.prefs?.habitReminder])

  const changeReminder = async (on) => {
    setReminder(on)
    try {
      await actions.updatePrefs({ ...(member.prefs || {}), habitReminder: on })
      toast(on ? 'Recordatorio de hábitos activado' : 'Recordatorio de hábitos desactivado')
    } catch (err) {
      setReminder(!on)
      toast.error(err?.message || 'No se pudo guardar. Inténtalo de nuevo.')
    }
  }

  const streak = week.streak || 0

  return (
    <div {...memberProps(me)}>
      <header className="pt-8 pb-2">
        <div className="flex items-center gap-4">
          <AvatarRing
            userId={me}
            src={week.avatar || member.avatar}
            name={member.name}
            segments={week.goal}
            filled={week.sessions}
            rest={week.rest}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="type-title text-ink">{member.name}</h1>
            <p className="type-small mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <Flame aria-hidden="true" size={15} strokeWidth={2.4} className="text-member" />
                {streak > 0 ? `Racha de ${streak} ${plural(streak, 'semana', 'semanas')}` : 'Sin racha aún'}
              </span>
              <span className="tabular-nums">
                {album.earned} de {album.total} láminas
              </span>
            </p>
          </div>
        </div>
        <Link
          to={`/u/${me}`}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-sunk"
        >
          <UserRound aria-hidden="true" size={17} strokeWidth={2.2} />
          Ver mi perfil como lo ve la familia
        </Link>
      </header>

      {(isDemo || isReadonly) && (
        <p className="type-small mt-5 flex items-start gap-2 rounded-control bg-surface-sunk px-3.5 py-3 text-ink-soft">
          <Info aria-hidden="true" size={17} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          {isDemo
            ? 'Modo demo: los datos son de ejemplo y viven solo en este navegador. Nada llega a la familia.'
            : 'Modo solo lectura: ves los datos reales, pero ningún cambio se guarda.'}
        </p>
      )}

      <Section title="Tu semana" className="mt-9">
        <Surface>
          <WeeklyGoalControl member={member} actions={actions} />
          <div className="mt-4 border-t border-line pt-3">
            <p className="type-small mb-1 text-ink-soft">
              Una semana de descanso no suma ni rompe tu racha. Úsala para viajes, enfermedad o simplemente para parar.
            </p>
            <RestWeekToggles member={member} weekId={weekId} actions={actions} />
          </div>
        </Surface>
      </Section>

      <Section title="Lo tuyo" className="mt-9">
        <ul>
          <ShortcutRow to="/habitos" icon={ListChecks} title="Mis hábitos" description="Crea, ordena o archiva tus hábitos" />
          <ShortcutRow to="/metas" icon={Target} title="Mis metas" description="Metas con plazo y recompensa opcional" />
          <ShortcutRow to="/stats" icon={ChartColumn} title="Estadísticas" description="Tus números y los de la familia" />
          <ShortcutRow to="/novedades" icon={Sparkles} title="Novedades y cómo funciona" description="Qué cambió en la temporada 2" />
          <ShortcutRow to="/archivo" icon={Archive} title="Archivo de la temporada 1" description="La era de las multas, para el recuerdo" />
        </ul>
      </Section>

      <Section title="Preferencias" className="mt-9">
        <div className="flex flex-col gap-5">
          <div>
            <p className="type-body mb-2 font-medium text-ink">Tema</p>
            <SegmentedControl label="Tema" value={preference} onChange={setPreference} options={THEME_OPTIONS} />
          </div>
          <Surface>
            <NotificationsControl isDemo={isDemo} isReadonly={isReadonly} actions={actions} />
            <div className="mt-3 border-t border-line pt-2">
              <Toggle
                checked={reminder}
                onChange={changeReminder}
                label="Recordatorio de hábitos"
                description="A las 20:30, solo si te queda alguno sin marcar."
              />
            </div>
          </Surface>
        </div>
      </Section>

      <div className="mt-10 flex flex-col items-start gap-3 border-t border-line pt-5">
        <Button variant="danger-quiet" icon={LogOut} onClick={() => setConfirmLogout(true)} className={cx('-ml-3')}>
          Cerrar sesión
        </Button>
        <p className="type-caption text-ink-faint">FitFamily {version}</p>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="¿Cerrar sesión?"
        description="Para volver a entrar en este dispositivo vas a necesitar tu PIN."
        confirmLabel="Cerrar sesión"
        onConfirm={() => logout()}
      />
    </div>
  )
}

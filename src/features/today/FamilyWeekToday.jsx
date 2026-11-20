import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, Hand, LoaderCircle } from 'lucide-react'
import { AvatarRing, Chip, MemberName, Section, cx } from '../../components/ui'
import { useFamily, useFamilyWeek } from '../../data/FamilyDataProvider'
import { getMemberStatus, isBehind } from './todayCopy'

const STATUS_TONE = { done: 'font-semibold text-done-ink', rest: 'text-ink-soft', todo: 'text-ink-soft' }

/**
 * "La familia esta semana": los anillos de los 4 (toque → su perfil) y, para quien va
 * atrasado y hoy no ha entrenado, un "Dar un empujón" discreto (con su espera de 30 min).
 */
export default function FamilyWeekToday({ userId, todayIdx }) {
  const { actions } = useFamily()
  const family = useFamilyWeek()
  const [sending, setSending] = useState(null)
  const [, setTick] = useState(0) // re-render tras enviar para leer la nueva espera

  const nudgeable = family.members.filter((w) => w.userId !== userId && isBehind(w, todayIdx))

  const nudge = async (w) => {
    setSending(w.userId)
    try {
      await actions.sendNudge(w.userId)
      toast.success(`Empujón enviado a ${w.member.name}`, { description: 'Le llega como notificación.' })
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el empujón. Inténtalo de nuevo.')
    } finally {
      setSending(null)
      setTick((t) => t + 1)
    }
  }

  const description =
    family.completed === family.total
      ? 'Los cuatro lograron la semana.'
      : family.completed > 0
        ? `${family.completed} de ${family.total} ya la ${family.completed === 1 ? 'logró' : 'lograron'}.`
        : 'Se cierra el domingo a medianoche.'

  return (
    <Section title="La familia esta semana" description={description}>
      <ul className="grid grid-cols-4 gap-1">
        {family.members.map((w) => {
          const status = getMemberStatus(w)
          const isMe = w.userId === userId
          return (
            <li key={w.userId}>
              <Link
                to={`/u/${w.userId}`}
                className="flex flex-col items-center gap-2 rounded-control px-0.5 py-2 text-center transition-colors duration-150 hover:bg-ink/4"
              >
                <AvatarRing
                  userId={w.userId}
                  src={w.avatar}
                  name={w.member.name}
                  segments={w.goal}
                  filled={w.sessions}
                  rest={w.rest && !w.met}
                  size="md"
                />
                <span className="leading-tight">
                  <MemberName userId={w.userId} you={isMe} currentUserId={userId} className="type-small block" />
                  <span className={cx('type-caption block tabular-nums', STATUS_TONE[status.tone])}>{status.text}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      {nudgeable.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="type-small text-ink-soft">
            Dar un empujón: le llega una notificación para animarse.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nudgeable.map((w) => {
              const wait = actions.nudgeCooldownMinutes(w.userId)
              const name = w.member.name
              return (
                <li key={w.userId}>
                  <Chip
                    icon={sending === w.userId ? LoaderCircle : wait > 0 ? Check : Hand}
                    aria-pressed={undefined}
                    disabled={wait > 0 || sending === w.userId}
                    onClick={() => nudge(w)}
                    aria-label={wait > 0 ? `Empujón enviado a ${name}. Puedes enviar otro en ${wait} min.` : `Dar un empujón a ${name}`}
                    title={wait > 0 ? `Puedes enviar otro en ${wait} min` : undefined}
                    className={cx('disabled:cursor-default', wait > 0 && 'text-ink-soft', sending === w.userId && '[&_svg]:animate-spin')}
                  >
                    {wait > 0 ? `${name}, enviado` : name}
                  </Chip>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Section>
  )
}

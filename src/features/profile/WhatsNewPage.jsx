import { Link } from 'react-router-dom'
import { Camera, Flame, HandCoins, ListChecks, Moon, Sticker, Target, Trophy } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { useFamily } from '../../data/FamilyDataProvider'
import { useAuth } from '../../auth/AuthContext'

const plural = (n, one, many) => (n === 1 ? one : many)

function Topic({ icon: Icon, title, children }) {
  return (
    <section className="flex gap-4 border-t border-line py-6 first:border-t-0 first:pt-0">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink"
      >
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <h2 className="type-sub text-ink">{title}</h2>
        <div className="type-body mt-1.5 flex flex-col gap-2 text-ink-soft">{children}</div>
      </div>
    </section>
  )
}

const linkClass = 'font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink'

/** Novedades: qué cambió en la temporada 2 y cómo funciona, en palabras simples. */
export default function WhatsNewPage() {
  const { members } = useFamily()
  const { currentUser } = useAuth()
  const goal = members.find((m) => m.id === currentUser?.id)?.weeklyGoal ?? 3

  return (
    <>
      <PageHeader
        title="Temporada 2"
        description="Qué cambió y cómo funciona ahora. Lo importante cabe en un minuto de lectura."
        back="/perfil"
      />

      <div>
        <Topic icon={HandCoins} title="Se acabaron las multas">
          <p>
            No hay pozo, ni vidas, ni escudos, ni canjes, ni juez. Si una semana no sale, no pasa nada: la siguiente
            parte de cero. Lo que pasó en la temporada 1 quedó guardado en el{' '}
            <Link to="/archivo" className={linkClass}>
              archivo
            </Link>
            , solo para mirar.
          </p>
        </Topic>

        <Topic icon={Target} title="Tu meta semanal es tuya">
          <p>
            Cada uno decide cuántas sesiones por semana quiere hacer, de 1 a 7. Hoy la tuya es de{' '}
            <strong className="font-semibold text-ink">
              {goal} {plural(goal, 'sesión', 'sesiones')}
            </strong>
            . Se cambia en{' '}
            <Link to="/perfil" className={linkClass}>
              Perfil
            </Link>{' '}
            y aplica desde la semana en curso.
          </p>
          <p>La semana va de lunes a domingo y se logra cuando llegas a tu meta.</p>
        </Topic>

        <Topic icon={Flame} title="Rachas">
          <p>
            Tu racha cuenta cuántas semanas seguidas lograste tu meta. Una semana que no sale la corta; la semana en
            curso suma en cuanto la logras.
          </p>
        </Topic>

        <Topic icon={Moon} title="Semana de descanso">
          <p>
            Si viajas, te enfermas o simplemente necesitas parar, marca la semana como descanso (la actual o la
            siguiente) desde tu perfil. Es neutra: no suma ni rompe tu racha. No hay que justificar nada.
          </p>
        </Topic>

        <Topic icon={ListChecks} title="Hábitos">
          <p>
            Además del ejercicio, puedes seguir hábitos propios: leer, meditar, tomar agua, dormir bien. Cada uno con su
            emoji y cuántos días por semana. Se marcan con un toque, hoy o cualquier día anterior de la semana.
          </p>
          <p>
            La familia los ve, salvo que marques uno como privado. Los hábitos no cambian si tu semana de ejercicio se
            logra.{' '}
            <Link to="/habitos" className={linkClass}>
              Ver mis hábitos
            </Link>
          </p>
        </Topic>

        <Topic icon={Trophy} title="Metas con recompensa">
          <p>
            Puedes ponerte metas con plazo, como "12 sesiones en diciembre" o "leer 20 días este mes". Algunas se miden
            solas con lo que registras; otras las vas actualizando tú, como "correr 100 km".
          </p>
          <p>
            Si quieres, agrégale una recompensa ("si lo logro, me compro las zapatillas"). Cuando la logras, la familia
            se entera. Si no se logra, no pasa nada.{' '}
            <Link to="/metas" className={linkClass}>
              Ver mis metas
            </Link>
          </p>
        </Topic>

        <Topic icon={Sticker} title="El álbum de láminas">
          <p>
            Los logros ahora son láminas numeradas: comunes, raras, épicas y legendarias. Se ganan con constancia,
            minutos, variedad, hábitos y cosas que hace la familia junta. Las que ganaste con tu historial ya están
            pegadas.
          </p>
          <p>
            Las que te faltan muestran cuánto te queda.{' '}
            <Link to="/logros" className={linkClass}>
              Abrir el álbum
            </Link>
          </p>
        </Topic>

        <Topic icon={Camera} title="La foto sigue siendo obligatoria">
          <p>
            Cada ejercicio se registra con una foto de ese día, igual que antes. Es lo que hace que el feed de la
            familia sea entretenido. Lo que se fue son los reportes y las votaciones de fotos.
          </p>
        </Topic>
      </div>
    </>
  )
}

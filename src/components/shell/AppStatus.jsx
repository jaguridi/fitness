import { RefreshCw } from 'lucide-react'
import Button from '../ui/Button'

/** Pantalla de carga: cuatro puntos, uno por persona, que saltan por turnos. */
export function AppLoading({ label = 'Cargando la semana de la familia' }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="flex flex-col items-start gap-4">
        <span className="type-heading text-ink">FitFamily</span>
        <span className="flex gap-2" aria-hidden="true">
          {['user1', 'user2', 'user3', 'user4'].map((u, i) => (
            <span
              key={u}
              className="size-3 rounded-full motion-safe:animate-loading-dot"
              style={{ background: `var(--m-${u})`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

/** Pantalla de error: qué pasó y cómo seguir. */
export function AppError({ error }) {
  return (
    <div className="flex min-h-dvh items-center bg-paper px-6">
      <div className="mx-auto w-full max-w-md">
        <h1 className="type-title text-ink">No pudimos cargar los datos de la familia</h1>
        <p className="type-body mt-3 max-w-[36ch] text-ink-soft">
          Revisa tu conexión y vuelve a intentarlo. Si sigue pasando, avísale a Jose.
        </p>
        {/* The data provider reports errors as plain strings; tolerate Error objects too. */}
        {(typeof error === 'string' ? error : error?.message) && (
          <p className="type-small mt-4 rounded-control bg-surface-sunk px-3 py-2 font-medium text-ink-soft">
            {typeof error === 'string' ? error : error.message}
          </p>
        )}
        <Button className="mt-6" icon={RefreshCw} onClick={() => window.location.reload()}>
          Volver a intentar
        </Button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Button, Surface, SkeletonText } from '../../components/ui'
import { useFamily } from '../../data/FamilyDataProvider'
import { monthLabel, previousMonthId } from './statsHelpers'

/**
 * Resumen mensual con IA del último mes terminado, a pedido. Llama a una
 * Cloud Function que puede tardar o no estar disponible: muestra carga y un
 * error amable con reintento, y nunca bloquea la página.
 */
export default function MonthlyRecap() {
  const { actions, today, isReadonly } = useFamily()
  const monthId = previousMonthId(today)
  const month = monthLabel(monthId)
  const [state, setState] = useState({ status: 'idle', text: '' })

  const load = async () => {
    setState({ status: 'loading', text: '' })
    try {
      const res = await actions.getMonthlyRecap(monthId)
      const text = typeof res === 'string' ? res : res?.recap
      setState(text ? { status: 'done', text } : { status: 'empty', text: '' })
    } catch (err) {
      const notFound = err?.code === 'functions/not-found' || /not-found|no hay datos/i.test(err?.message || '')
      setState({ status: notFound ? 'empty' : 'error', text: '' })
    }
  }

  return (
    <Surface variant="sunk" padding="lg">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft">
          <Sparkles size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-body font-semibold text-ink">Resumen de {month}</h3>
          <p className="type-small mt-0.5 text-ink-soft">Lo escribe una IA con lo que la familia registró ese mes.</p>
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {state.status === 'idle' && (
          <Button variant="secondary" onClick={load}>
            Ver el resumen de {month}
          </Button>
        )}
        {state.status === 'loading' && (
          <div>
            <SkeletonText lines={3} />
            <p className="type-caption mt-3 text-ink-faint">Puede tardar unos segundos si es la primera vez que alguien lo pide.</p>
          </div>
        )}
        {state.status === 'done' && <p className="type-body whitespace-pre-line text-ink">{state.text}</p>}
        {state.status === 'empty' && (
          <p className="type-small text-ink-soft">
            {isReadonly
              ? 'En modo solo lectura no se generan resúmenes nuevos, y este mes aún no tiene uno guardado.'
              : `Todavía no hay un resumen de ${month}. Vuelve a mirar en unos días.`}
          </p>
        )}
        {state.status === 'error' && (
          <div className="flex flex-col items-start gap-3">
            <p className="type-small text-ink-soft">No se pudo traer el resumen ahora. Revisa tu conexión e inténtalo de nuevo en un rato.</p>
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={load}>
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </Surface>
  )
}

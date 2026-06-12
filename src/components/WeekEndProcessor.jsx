import { useState } from 'react'
import { toast } from 'sonner'
import Card from './ui/Card'
import ConfirmDialog from './ui/ConfirmDialog'

export default function WeekEndProcessor({ onProcess, currentWeekId }) {
  const [confirming, setConfirming] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)

  const handleProcess = async () => {
    setConfirming(false)
    setProcessing(true)
    try {
      await onProcess(currentWeekId)
      setDone(true)
    } catch (err) {
      console.error(err)
      toast.error('Error al procesar la semana.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-bold text-white mb-2">⚙️ Cierre Semanal</h3>
      <p className="text-sm text-gray-400 mb-3">
        Ejecuta el cierre de la semana actual para calcular multas, vidas ganadas y
        vidas consumidas. Solo hazlo cuando la semana haya terminado.
      </p>
      <button
        onClick={() => setConfirming(true)}
        disabled={processing || done}
        className={`w-full py-3 rounded-xl font-bold transition-all ${
          processing || done
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-500 text-white active:scale-95'
        }`}
      >
        {processing
          ? '⏳ Procesando...'
          : done
          ? '✅ Semana procesada'
          : '🔒 Cerrar Semana y Calcular'}
      </button>

      {confirming && (
        <ConfirmDialog
          icon="🔒"
          title="¿Cerrar la semana?"
          message="Se calcularán multas, vidas ganadas y vidas consumidas. Hazlo solo cuando la semana haya terminado."
          confirmLabel="Cerrar semana"
          danger
          onConfirm={handleProcess}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Card>
  )
}

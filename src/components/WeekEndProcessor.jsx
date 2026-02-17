import { useState } from 'react'

export default function WeekEndProcessor({ onProcess, currentWeekId }) {
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)

  const handleProcess = async () => {
    if (!confirm('¿Estás seguro de cerrar esta semana y calcular multas/vidas?')) return
    setProcessing(true)
    try {
      await onProcess(currentWeekId)
      setDone(true)
    } catch (err) {
      console.error(err)
      alert('Error al procesar la semana.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-2">⚙️ Cierre Semanal</h3>
      <p className="text-sm text-gray-400 mb-3">
        Ejecuta el cierre de la semana actual para calcular multas, vidas ganadas y
        vidas consumidas. Solo hazlo cuando la semana haya terminado.
      </p>
      <button
        onClick={handleProcess}
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
    </div>
  )
}

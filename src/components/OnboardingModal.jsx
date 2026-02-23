import { useState } from 'react'
import { registerPushToken } from '../services/notificationService'

const STORAGE_KEY = 'fitfamily_onboarded'

// Detect platform
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
const isAndroid = /Android/.test(navigator.userAgent)
const isPWA = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY)
}

export default function OnboardingModal({ userId, onDone }) {
  const [step, setStep] = useState(0) // 0 = install, 1 = notifications
  const [notifStatus, setNotifStatus] = useState('idle') // idle | loading | granted | denied

  const handleDone = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    onDone()
  }

  const handleEnableNotifications = async () => {
    setNotifStatus('loading')
    const token = await registerPushToken(userId)
    setNotifStatus(token ? 'granted' : 'denied')
  }

  // Step 0 — Install as PWA
  const InstallStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-5xl mb-3">📲</div>
        <h2 className="text-xl font-black text-white">Instala FitFamily</h2>
        <p className="text-sm text-gray-400 mt-1">
          Guarda la app en tu pantalla de inicio para acceder rápido sin buscar la URL
        </p>
      </div>

      {isPWA ? (
        <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 text-center">
          <p className="text-green-400 font-semibold">✅ Ya tienes la app instalada</p>
        </div>
      ) : isIOS ? (
        <div className="bg-gray-700/50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">En iPhone / iPad (Safari):</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
              Toca el botón de compartir <span className="bg-gray-600 rounded px-1 mx-0.5">□↑</span> en Safari
            </li>
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
              Selecciona <strong>"Añadir a pantalla de inicio"</strong>
            </li>
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
              Toca <strong>"Añadir"</strong> y abre la app desde el ícono 💪
            </li>
          </ol>
          <p className="text-xs text-amber-400">⚠️ Las notificaciones solo funcionan desde el ícono, no desde Safari</p>
        </div>
      ) : isAndroid ? (
        <div className="bg-gray-700/50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">En Android (Chrome):</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
              Toca el menú <strong>⋮</strong> arriba a la derecha
            </li>
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
              Selecciona <strong>"Añadir a pantalla de inicio"</strong> o <strong>"Instalar app"</strong>
            </li>
            <li className="flex gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
              Confirma y abre la app desde el ícono 💪
            </li>
          </ol>
        </div>
      ) : (
        <div className="bg-gray-700/50 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-white">En el navegador:</p>
          <p className="text-sm text-gray-300">
            Busca el ícono <strong>"Instalar"</strong> (⊕) en la barra de direcciones, o en el menú del navegador selecciona <strong>"Instalar FitFamily"</strong>.
          </p>
        </div>
      )}

      <button
        onClick={() => setStep(1)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95"
      >
        Continuar →
      </button>
      <button
        onClick={handleDone}
        className="w-full py-2 text-sm text-gray-500 hover:text-gray-400"
      >
        Saltar por ahora
      </button>
    </div>
  )

  // Step 1 — Enable notifications
  const NotifStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-5xl mb-3">🔔</div>
        <h2 className="text-xl font-black text-white">Activa las notificaciones</h2>
        <p className="text-sm text-gray-400 mt-1">
          Te avisamos si vas atrasado con tus sesiones — sin spam, solo 3 recordatorios por semana
        </p>
      </div>

      <div className="bg-gray-700/50 rounded-2xl p-4 space-y-2 text-sm text-gray-300">
        <div className="flex gap-2 items-center">
          <span>📅</span><span><strong>Lunes 9am</strong> — arranca la semana</span>
        </div>
        <div className="flex gap-2 items-center">
          <span>⚠️</span><span><strong>Jueves 9am</strong> — aviso si llevas menos de 2 sesiones</span>
        </div>
        <div className="flex gap-2 items-center">
          <span>🚨</span><span><strong>Domingo 5pm</strong> — último llamado si no completaste la meta</span>
        </div>
      </div>

      {notifStatus === 'granted' ? (
        <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 text-center">
          <p className="text-green-400 font-bold text-lg">✅ ¡Notificaciones activadas!</p>
        </div>
      ) : notifStatus === 'denied' ? (
        <div className="bg-red-900/20 border border-red-700/30 rounded-2xl p-4 text-center space-y-1">
          <p className="text-red-400 font-semibold">Permiso denegado</p>
          <p className="text-xs text-gray-400">Puedes activarlas después en la configuración del sitio en tu browser</p>
        </div>
      ) : (
        <button
          onClick={handleEnableNotifications}
          disabled={notifStatus === 'loading'}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white font-bold rounded-2xl transition-all active:scale-95"
        >
          {notifStatus === 'loading' ? '⏳ Activando...' : '🔔 Activar notificaciones'}
        </button>
      )}

      <button
        onClick={handleDone}
        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-2xl transition-all active:scale-95"
      >
        {notifStatus === 'granted' ? '¡Listo! Entrar a la app 💪' : 'Saltar por ahora'}
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-800 rounded-3xl border border-gray-700 w-full max-w-sm p-6 space-y-2">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${step === 0 ? 'bg-indigo-400' : 'bg-gray-600'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-indigo-400' : 'bg-gray-600'}`} />
        </div>

        {step === 0 ? <InstallStep /> : <NotifStep />}
      </div>
    </div>
  )
}

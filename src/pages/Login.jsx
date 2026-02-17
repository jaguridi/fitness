import { useState } from 'react'
import { USERS } from '../constants'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

export default function Login() {
  const { login, checkUserPin } = useAuth()
  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [isNewPin, setIsNewPin] = useState(false)
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingPin, setCheckingPin] = useState(false)

  const handleSelectUser = async (user) => {
    setSelectedUser(user)
    setPin('')
    setConfirmPin('')
    setError('')
    setCheckingPin(true)

    try {
      const existingPin = await checkUserPin(user.id)
      setIsNewPin(!existingPin)
    } catch {
      setIsNewPin(true)
    } finally {
      setCheckingPin(false)
    }
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPin('')
    setConfirmPin('')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos.')
      return
    }

    if (isNewPin && pin !== confirmPin) {
      setError('Los PINs no coinciden.')
      return
    }

    setLoading(true)
    try {
      await login(selectedUser.id, pin)
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">💪</div>
          <h1 className="text-3xl font-black text-white">FitFamily</h1>
          <p className="text-gray-400 text-sm mt-1">Tracker Familiar de Ejercicio</p>
        </div>

        {!selectedUser ? (
          /* Step 1: Select user */
          <div>
            <p className="text-gray-300 text-center mb-4 font-medium">¿Quién eres?</p>
            <div className="grid grid-cols-2 gap-3">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 rounded-2xl p-4 text-center transition-all active:scale-95"
                >
                  <div className="mb-2"><Avatar src={u.avatar} name={u.name} size="lg" /></div>
                  <div className="text-white font-semibold">{u.name}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Step 2: Enter PIN */
          <div>
            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white mb-4 text-sm flex items-center gap-1"
            >
              ← Cambiar usuario
            </button>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              {/* User avatar */}
              <div className="text-center mb-4">
                <div className="mb-2 flex justify-center"><Avatar src={selectedUser.avatar} name={selectedUser.name} size="xl" /></div>
                <h2 className="text-xl font-bold text-white">{selectedUser.name}</h2>
              </div>

              {checkingPin ? (
                <p className="text-gray-400 text-center py-4">Verificando...</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {isNewPin ? '🔐 Crea tu PIN (4 dígitos)' : '🔑 Ingresa tu PIN'}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      autoFocus
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {isNewPin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Confirma tu PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="• • • •"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {error && (
                    <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-2 text-center">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || pin.length !== 4}
                    className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                      loading || pin.length !== 4
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                    }`}
                  >
                    {loading ? '⏳ Entrando...' : isNewPin ? '🔐 Crear PIN y Entrar' : '🔑 Entrar'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

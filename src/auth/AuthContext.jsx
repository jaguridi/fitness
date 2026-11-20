/**
 * PIN login (same behaviour as v1): the session is just the chosen userId in
 * localStorage ('fitfamily_user'). PINs are stored as SHA-256(salt:pin) with a
 * random per-user salt; legacy plaintext PINs migrate on first login.
 * In demo mode any 4-digit PIN logs in.
 *
 * useAuth() → { currentUser, isLoggedIn, loading, login(userId, pin), logout(), checkUserPin(userId) }
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { USERS } from '../constants.js'
import { getBackend, IS_DEMO } from '../data/index.js'

const AuthContext = createContext(null)
const STORAGE_KEY = 'fitfamily_user'

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function readStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const { userId } = JSON.parse(stored)
    return USERS.find((u) => u.id === userId) || null
  } catch {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    return null
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCurrentUser(readStoredUser())
    setLoading(false)
  }, [])

  /** Does the user already have a PIN (hashed or legacy plaintext)? */
  const checkUserPin = useCallback(async (userId) => {
    if (IS_DEMO) return true
    const backend = await getBackend()
    const userData = await backend.getUser(userId)
    return Boolean(userData?.pinHash || userData?.pin)
  }, [])

  /** Validate (or create, the first time) the PIN and start the session. */
  const login = useCallback(async (userId, pin) => {
    const user = USERS.find((u) => u.id === userId)
    if (!user) throw new Error('Usuario desconocido')

    if (IS_DEMO) {
      if (!/^\d{4}$/.test(String(pin))) throw new Error('El PIN debe tener 4 dígitos')
    } else {
      const backend = await getBackend()
      const userData = await backend.getUser(userId)
      if (userData?.pinHash && userData?.pinSalt) {
        if ((await hashPin(pin, userData.pinSalt)) !== userData.pinHash) throw new Error('PIN incorrecto')
      } else if (userData?.pin) {
        // Legacy plaintext PIN: validate, then migrate to a hash and drop the plaintext.
        if (String(userData.pin) !== String(pin)) throw new Error('PIN incorrecto')
        const salt = randomSalt()
        await backend.setUser(userId, { pinHash: await hashPin(pin, salt), pinSalt: salt }, { remove: ['pin'] })
      } else {
        // First time: create the hashed PIN.
        const salt = randomSalt()
        await backend.setUser(userId, { pinHash: await hashPin(pin, salt), pinSalt: salt })
      }
    }

    setCurrentUser(user)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId })) } catch { /* private mode */ }
    return user
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => ({
    currentUser,
    isLoggedIn: !!currentUser,
    loading,
    login,
    logout,
    checkUserPin,
  }), [currentUser, loading, login, logout, checkUserPin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext

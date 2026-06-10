import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { deleteField } from 'firebase/firestore'
import { USERS } from '../constants'
import { getUser, setUser } from '../services/firebaseService'

const AuthContext = createContext(null)

// ── PIN hashing ──────────────────────────────────────────────
// PINs used to be stored in plaintext, readable by anyone with the (public)
// Firebase config. They are now stored as SHA-256(salt:pin) with a random
// per-user salt; existing plaintext PINs migrate transparently on first login.
// Requires a secure context (HTTPS / localhost), which GitHub Pages provides.

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('fitfamily_user')
    if (stored) {
      try {
        const { userId } = JSON.parse(stored)
        const user = USERS.find((u) => u.id === userId)
        if (user) {
          setCurrentUser(user)
        }
      } catch {
        localStorage.removeItem('fitfamily_user')
      }
    }
    setLoading(false)
  }, [])

  // Does the user already have a PIN (hashed or legacy plaintext)?
  const checkUserPin = useCallback(async (userId) => {
    const userData = await getUser(userId)
    return Boolean(userData?.pinHash || userData?.pin)
  }, [])

  // Login: validate or create PIN
  const login = useCallback(async (userId, pin) => {
    const userData = await getUser(userId)

    if (userData?.pinHash && userData?.pinSalt) {
      // Hashed PIN
      const candidate = await hashPin(pin, userData.pinSalt)
      if (candidate !== userData.pinHash) {
        throw new Error('PIN incorrecto')
      }
    } else if (userData?.pin) {
      // Legacy plaintext PIN: validate, then migrate to hash and drop plaintext
      if (userData.pin !== pin) {
        throw new Error('PIN incorrecto')
      }
      const salt = randomSalt()
      await setUser(userId, {
        pinHash: await hashPin(pin, salt),
        pinSalt: salt,
        pin: deleteField(),
      })
    } else {
      // First time: create hashed PIN
      const salt = randomSalt()
      await setUser(userId, {
        pinHash: await hashPin(pin, salt),
        pinSalt: salt,
      })
    }

    const user = USERS.find((u) => u.id === userId)
    setCurrentUser(user)
    localStorage.setItem('fitfamily_user', JSON.stringify({ userId }))
    return user
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    localStorage.removeItem('fitfamily_user')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn: !!currentUser,
        loading,
        login,
        logout,
        checkUserPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext

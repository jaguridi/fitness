import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS } from '../constants'
import { getUser, setUser } from '../services/firebaseService'

const AuthContext = createContext(null)

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

  // Check if user has a PIN set in Firestore
  const checkUserPin = useCallback(async (userId) => {
    const userData = await getUser(userId)
    return userData?.pin || null
  }, [])

  // Login: validate or create PIN
  const login = useCallback(async (userId, pin) => {
    const userData = await getUser(userId)
    const existingPin = userData?.pin

    if (existingPin) {
      // Validate PIN
      if (existingPin !== pin) {
        throw new Error('PIN incorrecto')
      }
    } else {
      // First time: save new PIN
      await setUser(userId, { pin })
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

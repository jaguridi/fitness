// Import-resolution smoke test for the React layer in demo mode: the backend
// switch picks the demo backend, and the providers render (SSR, no effects).
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('../../firebase.js', () => { throw new Error('firebase must not load in demo mode') })

describe('demo mode wiring', () => {
  it('getBackend() returns the demo backend', async () => {
    vi.stubEnv('VITE_DEMO', '1')
    vi.resetModules()
    const { getBackend, IS_DEMO } = await import('../index.js')
    expect(IS_DEMO).toBe(true)
    const b = await getBackend()
    expect(b.kind).toBe('demo')
    let users
    b.subscribeUsers((l) => { users = l })
    expect(users).toHaveLength(4)
  })

  it('AuthProvider + FamilyDataProvider render and expose the contract', async () => {
    vi.stubEnv('VITE_DEMO', '1')
    vi.resetModules()
    const { AuthProvider, useAuth } = await import('../../auth/AuthContext.jsx')
    const { FamilyDataProvider, useFamily } = await import('../FamilyDataProvider.jsx')
    let auth, family
    function Probe() {
      auth = useAuth()
      family = useFamily()
      return null
    }
    renderToString(createElement(AuthProvider, null, createElement(FamilyDataProvider, null, createElement(Probe))))
    expect(Object.keys(auth).sort()).toEqual(['checkUserPin', 'currentUser', 'isLoggedIn', 'loading', 'login', 'logout'])
    expect(family).toMatchObject({ ready: false, isDemo: true, backendKind: 'demo' })
    for (const k of ['logWorkout', 'react', 'comment', 'saveHabit', 'toggleHabitCheck', 'setWeeklyGoal', 'setRestWeek',
      'updatePrefs', 'recordUnlock', 'seedUnlocks', 'sendNudge', 'registerPush', 'getWeeklyRecap', 'getMonthlyRecap',
      'uploadWorkoutPhoto', 'saveGoal', 'updateGoalProgress', 'cancelGoal', 'archiveHabit', 'updateWorkout', 'deleteWorkout']) {
      expect(typeof family.actions[k], k).toBe('function')
    }
    expect(family.members).toHaveLength(4)
    expect(family.state.weekId).toMatch(/^\d{4}-W\d{2}$/)
    vi.unstubAllEnvs()
  })
})

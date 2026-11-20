import { describe, it, expect } from 'vitest'
import { createUnlockTracker, enqueue, retryDelay, RETRY_DELAYS } from '../unlockTracker'

const p = (...ids) => ids.map((id) => ({ id }))

describe('unlock tracker', () => {
  it('seeds once, silently, and never celebrates seeded stickers', () => {
    const t = createUnlockTracker()
    const a = t.plan({ userId: 'u1', needsSeed: true, pending: p('x', 'y'), now: 0 })
    expect(a).toEqual({ seed: ['x', 'y'], record: [], celebrate: [] })
    // re-render while the seed is in flight
    expect(t.plan({ userId: 'u1', needsSeed: true, pending: p('x', 'y'), now: 1 }).seed).toBeNull()
    t.seedDone('u1')
    // users doc updated before the unlock docs arrive: still pending, still silent
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('x', 'y'), now: 2 })).toEqual({ seed: null, record: [], celebrate: [] })
    // a genuinely new sticker afterwards is recorded and celebrated
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('x', 'y', 'z'), now: 3 })).toEqual({ seed: null, record: ['z'], celebrate: ['z'] })
  })

  it('records and celebrates each pending sticker exactly once across re-renders', () => {
    const t = createUnlockTracker()
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a', 'b'), now: 0 })).toEqual({ seed: null, record: ['a', 'b'], celebrate: ['a', 'b'] })
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a', 'b'), now: 1 })).toEqual({ seed: null, record: [], celebrate: [] })
    t.recordDone('u1', 'a')
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now: 2 }).record).toEqual([])
  })

  it('retries a failed write with backoff, without celebrating again, then gives up', () => {
    const t = createUnlockTracker()
    t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now: 0 })
    let now = 0
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      t.recordFailed('u1', 'a', now)
      expect(t.nextRetryIn(now)).toBe(RETRY_DELAYS[i])
      expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now: now + RETRY_DELAYS[i] - 1 }).record).toEqual([])
      now += RETRY_DELAYS[i]
      expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now })).toEqual({ seed: null, record: ['a'], celebrate: [] })
    }
    t.recordFailed('u1', 'a', now)
    expect(t.nextRetryIn(now)).toBeNull()
    expect(t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now: now + 1e9 }).record).toEqual([])
  })

  it('retries a failed seed', () => {
    const t = createUnlockTracker()
    t.plan({ userId: 'u1', needsSeed: true, pending: p('x'), now: 0 })
    t.seedFailed('u1', 0)
    expect(t.plan({ userId: 'u1', needsSeed: true, pending: p('x'), now: 10 }).seed).toBeNull()
    expect(t.plan({ userId: 'u1', needsSeed: true, pending: p('x'), now: RETRY_DELAYS[0] }).seed).toEqual(['x'])
  })

  it('keeps users apart and ignores a missing user', () => {
    const t = createUnlockTracker()
    expect(t.plan({ userId: null, needsSeed: false, pending: p('a') }).record).toEqual([])
    t.plan({ userId: 'u1', needsSeed: false, pending: p('a'), now: 0 })
    expect(t.plan({ userId: 'u2', needsSeed: false, pending: p('a'), now: 0 }).celebrate).toEqual(['a'])
  })
})

describe('helpers', () => {
  it('retryDelay', () => {
    expect(retryDelay(0)).toBe(0)
    expect(retryDelay(1)).toBe(RETRY_DELAYS[0])
    expect(retryDelay(RETRY_DELAYS.length + 1)).toBeNull()
  })
  it('enqueue adds without duplicates and keeps identity when nothing changes', () => {
    const q = ['a']
    expect(enqueue(q, ['a'])).toBe(q)
    expect(enqueue(q, ['b', 'a', 'b'])).toEqual(['a', 'b'])
  })
})

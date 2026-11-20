import { describe, it, expect } from 'vitest'
import {
  closestStickers, earnedDateLabel, familyComparison, formatProgress, isMeasurable, ownersOf, progressUnit, shortDateLabel,
} from '../albumUtils'
import { ACHIEVEMENTS } from '../../../domain/achievements.js'

const st = (id, current, target, extra = {}) => ({
  id, number: extra.number ?? 1, rarity: extra.rarity ?? 'comun', earned: false,
  progress: target == null ? null : { current, target }, ...extra,
})

describe('formatProgress', () => {
  it('uses the sticker unit and es-CL thousands', () => {
    expect(formatProgress(st('streak_4', 3, 4))).toBe('3 de 4 semanas')
    expect(formatProgress(st('total_burn_20000', 4230, 20000))).toBe('4.230 de 20.000 kcal')
    expect(formatProgress(st('day_streak_7', 2, 7))).toBe('2 de 7 días')
    expect(formatProgress(st('sessions_10', 1, 10), { short: true })).toBe('1 de 10')
  })
  it('is null when not measurable', () => {
    expect(formatProgress(st('first_comment', 0, null))).toBeNull()
    expect(isMeasurable(st('first_week', 0, 1))).toBe(false)
  })
  it('knows a unit for every measurable sticker', () => {
    const missing = ACHIEVEMENTS.filter((a) => a.progress && !progressUnit(a.id) && a.id !== 'first_week').map((a) => a.id)
    expect(missing).toEqual([])
  })
})

describe('closestStickers', () => {
  it('ranks unearned stickers by progress ratio, ties by rarity then number', () => {
    const list = [
      st('a', 1, 4, { number: 1 }), // 0.25
      st('b', 3, 4, { number: 2, rarity: 'epica' }), // 0.75
      st('c', 9, 12, { number: 3 }), // 0.75 común → before b
      st('d', 4, 5, { number: 4, earned: true }), // earned: out
      st('e', 0, 10, { number: 5 }), // no progress: out
      st('f', 1, null, { number: 6 }), // not measurable: out
      st('g', 4, 5, { number: 7 }), // 0.8
    ]
    expect(closestStickers(list).map((a) => a.id)).toEqual(['g', 'c', 'b'])
    expect(closestStickers(list, 10).map((a) => a.id)).toEqual(['g', 'c', 'b', 'a'])
  })
  it('handles empty input', () => {
    expect(closestStickers(undefined)).toEqual([])
  })
})

describe('dates', () => {
  it('has no date for seeded or unrecorded stickers', () => {
    expect(earnedDateLabel({ earned: true, seeded: true, unlockedAt: 1 })).toBeNull()
    expect(earnedDateLabel({ earned: true, unlockedAt: null })).toBeNull()
    expect(earnedDateLabel({ earned: true, unlockedAt: new Date(2026, 10, 3, 12).getTime() })).toMatch(/3 de noviembre de 2026/)
  })
  it('says hoy / ayer', () => {
    const now = new Date(2026, 10, 20, 15).getTime()
    expect(shortDateLabel(new Date(2026, 10, 20, 8).getTime(), now)).toBe('Hoy')
    expect(shortDateLabel(new Date(2026, 10, 19, 23).getTime(), now)).toBe('Ayer')
    expect(shortDateLabel(null, now)).toBeNull()
  })
})

describe('familyComparison', () => {
  const members = [{ id: 'u1' }, { id: 'u2' }]
  const lists = {
    u1: [{ id: 'x', rarity: 'comun', earned: true }, { id: 'y', rarity: 'legendaria', earned: true }],
    u2: [{ id: 'x', rarity: 'comun', earned: true }, { id: 'y', rarity: 'legendaria', earned: false }],
  }
  const get = (id) => lists[id]
  it('counts per member and rarity, and stickers everyone has', () => {
    const c = familyComparison(members, get)
    expect(c.rows[0]).toMatchObject({ userId: 'u1', earned: 2, total: 2 })
    expect(c.rows[1].byRarity.legendaria).toEqual({ earned: 0, total: 1 })
    expect(c.shared).toBe(1)
    expect(c.owners.y).toEqual(['u1'])
  })
  it('lists owners in family order', () => {
    expect(ownersOf(members, get, 'x')).toEqual(['u1', 'u2'])
    expect(ownersOf(members, get, 'z')).toEqual([])
  })
})

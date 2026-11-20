import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dayCounts,
  formatTotalMinutes,
  isBehind,
  longDate,
  monthGrid,
  statusLine,
  stickerShowcase,
  workoutsByDate,
} from '../memberUtils'

const week = (o) => ({ sessions: 0, goal: 3, met: false, rest: false, extras: 0, daysLeft: 3, remaining: 3, closed: false, ...o })

describe('statusLine', () => {
  it('speaks in tú form for you and third person for others', () => {
    expect(statusLine(week({ sessions: 1, remaining: 2 }))).toBe('Lleva 1 de 3 sesiones. Quedan 3 días.')
    expect(statusLine(week({ sessions: 1, remaining: 2 }), { isMe: true })).toBe('Llevas 1 de 3 sesiones. Quedan 3 días.')
    expect(statusLine(week({ daysLeft: 1 }), { isMe: true })).toBe('Aún no entrenas esta semana. Queda 1 día.')
    expect(statusLine(week({ goal: 1, sessions: 0, daysLeft: 0 }))).toBe('Aún no entrena esta semana.')
  })
  it('celebrates met weeks and respects rest', () => {
    expect(statusLine(week({ sessions: 3, met: true }))).toBe('Semana lograda')
    expect(statusLine(week({ sessions: 4, met: true, extras: 1 }))).toBe('Semana lograda, con 1 sesión extra')
    expect(statusLine(week({ rest: true }), { isMe: true })).toBe('Te tomaste la semana de descanso')
    expect(statusLine(week({ rest: true }))).toBe('Se tomó la semana de descanso')
  })
})

describe('isBehind', () => {
  it('is true only when the sessions left are about the days left', () => {
    expect(isBehind(week({ remaining: 3, daysLeft: 7 }))).toBe(false)
    expect(isBehind(week({ remaining: 3, daysLeft: 4 }))).toBe(true)
    expect(isBehind(week({ remaining: 2, daysLeft: 3 }))).toBe(true)
    expect(isBehind(week({ met: true, remaining: 0 }))).toBe(false)
    expect(isBehind(week({ rest: true }))).toBe(false)
    expect(isBehind(null)).toBe(false)
  })
})

describe('calendar helpers', () => {
  it('pads a month to whole weeks, Monday first', () => {
    const nov = monthGrid(2026, 10) // noviembre 2026 empieza en domingo
    expect(nov.length % 7).toBe(0)
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(nov.filter(Boolean)).toHaveLength(30)
    expect(nov.filter(Boolean).at(-1)).toBe('2026-11-30')
    const feb = monthGrid(2027, 1) // febrero 2027 empieza en lunes
    expect(feb[0]).toBe('2027-02-01')
    expect(feb).toHaveLength(28)
  })
  it('moves across years', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
  it('groups workouts by date and counts per weekday', () => {
    const ws = [{ date: '2026-11-16' }, { date: '2026-11-16' }, { date: '2026-11-22' }, {}]
    expect(Object.keys(workoutsByDate(ws))).toEqual(['2026-11-16', '2026-11-22'])
    expect(dayCounts(ws)).toEqual([2, 0, 0, 0, 0, 0, 1])
  })
  it('writes long dates', () => {
    expect(longDate('2026-11-17', 2026)).toBe('martes 17 de noviembre')
    expect(longDate('2025-11-17', 2026)).toBe('lunes 17 de noviembre de 2025')
  })
})

describe('stickerShowcase', () => {
  const a = (id, rarity, o = {}) => ({ id, rarity, number: 1, earned: true, recorded: true, seeded: false, unlockedAt: 0, ...o })
  it('shows the latest real unlock first, then the rarest', () => {
    const list = [
      a('c1', 'comun', { unlockedAt: 500 }),
      a('r1', 'rara', { unlockedAt: 100 }),
      a('l1', 'legendaria', { seeded: true, unlockedAt: 50 }),
      a('e1', 'epica', { unlockedAt: 200 }),
      a('x', 'legendaria', { earned: false }),
    ]
    expect(stickerShowcase(list, 3).map((x) => x.id)).toEqual(['c1', 'l1', 'e1'])
  })
  it('is empty without earned stickers', () => {
    expect(stickerShowcase([a('x', 'comun', { earned: false })])).toEqual([])
  })
})

describe('formatTotalMinutes', () => {
  it('switches to hours past two hours', () => {
    expect(formatTotalMinutes(45)).toEqual({ value: '45', unit: 'min' })
    expect(formatTotalMinutes(1150)).toEqual({ value: '19', unit: 'h' })
    expect(formatTotalMinutes(90000)).toEqual({ value: '1.500', unit: 'h' })
  })
})

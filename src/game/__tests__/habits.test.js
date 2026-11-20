import { describe, it, expect } from 'vitest'
import {
  formatYMD, parseYMD, addDaysYMD, diffDaysYMD, weekdayIndex, weekIdOfDate, weekDates,
  getHabitTarget, isDailyHabit, getHabitChecks, computeHabitWeek, habitsForWeek, habitStartWeek,
  getHabitWeekStreak, getBestHabitWeekStreak, getHabitDayStreak, getBestHabitDayStreak,
  summarizeHabitWeek, isPerfectHabitWeek, longestDayRun,
} from '../habits.js'

describe('date helpers', () => {
  it('round-trips yyyy-MM-dd in local time', () => {
    expect(formatYMD(parseYMD('2026-11-20'))).toBe('2026-11-20')
    expect(parseYMD('')).toBeNull()
    expect(formatYMD(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('adds and diffs days across months, years and DST', () => {
    expect(addDaysYMD('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysYMD('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysYMD('2026-04-04', 1)).toBe('2026-04-05')
    expect(diffDaysYMD('2026-03-28', '2026-04-06')).toBe(9)
    expect(diffDaysYMD('2026-09-05', '2026-09-07')).toBe(2)
  })

  it('uses Monday as weekday 0', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-22')).toBe(6) // Sunday
  })

  it('maps dates to weekIds and back', () => {
    expect(weekIdOfDate('2026-11-20')).toBe('2026-W47')
    const dates = weekDates('2026-W47')
    expect(dates).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
    for (const d of dates) expect(weekIdOfDate(d)).toBe('2026-W47')
  })

  it('longestDayRun', () => {
    expect(longestDayRun([])).toBe(0)
    expect(longestDayRun(['2026-01-01', '2026-01-02', '2026-01-04'])).toBe(2)
  })
})

const WK = '2026-W47'
const D = weekDates(WK)
const PREV = weekDates('2026-W46')
const PREV2 = weekDates('2026-W45')

describe('habit basics', () => {
  it('clamps targets and detects daily habits', () => {
    expect(getHabitTarget({ targetPerWeek: 3 })).toBe(3)
    expect(getHabitTarget({ targetPerWeek: 10 })).toBe(7)
    expect(getHabitTarget({})).toBe(7)
    expect(isDailyHabit({ targetPerWeek: 7 })).toBe(true)
    expect(isDailyHabit({ targetPerWeek: 5 })).toBe(false)
  })

  it('reads and dedupes checks', () => {
    expect(getHabitChecks({ checks: { h: [D[1], D[0], D[1]] } }, 'h')).toEqual([D[0], D[1]])
    expect(getHabitChecks(null, 'h')).toEqual([])
  })

  it('computes week progress with a 7-day array', () => {
    const habit = { id: 'h', targetPerWeek: 3 }
    const hw = { checks: { h: [D[0], D[2], D[2], PREV[6]] } }
    const r = computeHabitWeek(habit, hw, WK)
    expect(r).toEqual({ habitId: 'h', done: 2, target: 3, met: false, days: [true, false, true, false, false, false, false], remaining: 1 })
    hw.checks.h.push(D[6])
    expect(computeHabitWeek(habit, hw, WK).met).toBe(true)
  })

  it('finds the creation week from any timestamp shape', () => {
    const ms = new Date(2026, 10, 18, 10).getTime()
    expect(habitStartWeek({ createdAt: ms })).toBe(WK)
    expect(habitStartWeek({ createdAt: { toMillis: () => ms } })).toBe(WK)
    expect(habitStartWeek({ createdAt: { seconds: ms / 1000 } })).toBe(WK)
    expect(habitStartWeek({ createdAt: new Date(ms) })).toBe(WK)
    expect(habitStartWeek({})).toBeNull()
  })

  it('habitsForWeek keeps archived habits only where they have checks', () => {
    const habits = [
      { id: 'a' },
      { id: 'b', archived: true },
      { id: 'c', archived: true },
      { id: 'd', createdAt: new Date(2026, 11, 1).getTime() },
    ]
    const hw = { checks: { c: [D[3]] } }
    expect(habitsForWeek(habits, WK, hw).map((h) => h.id)).toEqual(['a', 'c'])
  })
})

describe('habit streaks', () => {
  const habit = { id: 'h', targetPerWeek: 2, createdAt: new Date(2026, 10, 2).getTime() } // W45
  const weeks = [
    { weekId: '2026-W45', checks: { h: [PREV2[0], PREV2[1]] } },
    { weekId: '2026-W46', checks: { h: [PREV[3], PREV[4]] } },
    { weekId: WK, checks: { h: [D[0]] } },
  ]

  it('weekly streak counts back from last week, +1 when this week is met', () => {
    expect(getHabitWeekStreak(habit, weeks, { currentWeekId: WK })).toBe(2)
    const met = weeks.map((w) => (w.weekId === WK ? { ...w, checks: { h: [D[0], D[1]] } } : w))
    expect(getHabitWeekStreak(habit, met, { currentWeekId: WK })).toBe(3)
  })

  it('weekly streak breaks on a week without enough checks and stops at creation', () => {
    const gap = [weeks[0], { weekId: '2026-W46', checks: { h: [PREV[0]] } }, weeks[2]]
    expect(getHabitWeekStreak(habit, gap, { currentWeekId: WK })).toBe(0)
    expect(getHabitWeekStreak({ id: 'h', targetPerWeek: 2 }, weeks, { currentWeekId: WK })).toBe(2)
  })

  it('best weekly streak', () => {
    expect(getBestHabitWeekStreak(habit, weeks, { currentWeekId: WK })).toBe(2)
    expect(getBestHabitWeekStreak({ id: 'zz' }, weeks, { currentWeekId: WK })).toBe(0)
  })

  it('day streaks for daily habits cross week boundaries', () => {
    const daily = { id: 'w', targetPerWeek: 7 }
    const hws = [
      { weekId: '2026-W46', checks: { w: [PREV[5], PREV[6]] } },
      { weekId: WK, checks: { w: [D[0], D[1], D[2]] } },
    ]
    expect(getHabitDayStreak(daily, hws, D[2])).toBe(5)
    expect(getHabitDayStreak(daily, hws, D[3])).toBe(5) // today not checked yet
    expect(getHabitDayStreak(daily, hws, D[4])).toBe(0)
    expect(getBestHabitDayStreak(daily, hws)).toBe(5)
  })
})

describe('summarizeHabitWeek / perfect week', () => {
  const habits = [
    { id: 'a', name: 'Leer', emoji: '📚', targetPerWeek: 1, order: 2 },
    { id: 'b', name: 'Privado', emoji: '🤫', targetPerWeek: 1, visibility: 'private', order: 1 },
  ]
  it('summarizes all or only family habits, ordered', () => {
    const hw = { checks: { a: [D[0]], b: [] } }
    const all = summarizeHabitWeek(habits, hw, WK)
    expect(all.items.map((i) => i.habitId)).toEqual(['b', 'a'])
    expect(all).toMatchObject({ total: 2, met: 1, perfect: false })
    const fam = summarizeHabitWeek(habits, hw, WK, { visibility: 'family' })
    expect(fam).toMatchObject({ total: 1, met: 1, perfect: true })
  })

  it('perfect week needs at least one habit and all of them met', () => {
    expect(isPerfectHabitWeek([], null, WK)).toBe(false)
    expect(isPerfectHabitWeek(habits, { checks: { a: [D[0]], b: [D[1]] } }, WK)).toBe(true)
    expect(isPerfectHabitWeek(habits, { checks: { a: [D[0]] } }, WK)).toBe(false)
  })
})

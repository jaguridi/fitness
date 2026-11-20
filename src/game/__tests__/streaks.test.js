import { describe, it, expect } from 'vitest'
import {
  classifySummary, getWeeklyStreak, getBestWeeklyStreak, lastDecidedWeeks,
  getCurrentDayStreak, getBestDayStreak,
} from '../streaks.js'

const s = (weekId, status, extra = {}) => ({ weekId, status, ...extra })

describe('classifySummary', () => {
  it('handles v1 and v2 statuses', () => {
    expect(classifySummary(s('2026-W01', 'completed'))).toBe('success')
    expect(classifySummary(s('2026-W01', 'missed', { lifeUsed: true }))).toBe('success')
    for (const st of ['rest', 'frozen', 'holiday', 'paused']) expect(classifySummary(s('2026-W01', st))).toBe('neutral')
    expect(classifySummary(s('2026-W01', 'missed'))).toBe('break')
    expect(classifySummary(s('2026-W01', 'justified'))).toBe('break')
    expect(classifySummary(s('2026-W01', 'something_new'))).toBe('neutral')
    expect(classifySummary(null)).toBe('neutral')
  })
})

describe('getWeeklyStreak', () => {
  const history = [
    s('2026-W40', 'completed'),
    s('2026-W41', 'missed'),
    s('2026-W42', 'completed'),
    s('2026-W43', 'holiday'),
    s('2026-W44', 'completed', { lifeUsed: true }),
    s('2026-W45', 'frozen'),
    s('2026-W46', 'completed'),
  ]

  it('counts back skipping neutral weeks and stops at a break', () => {
    expect(getWeeklyStreak(history)).toBe(3)
  })

  it('is order-independent', () => {
    expect(getWeeklyStreak([...history].reverse())).toBe(3)
  })

  it('adds the current week when already met', () => {
    expect(getWeeklyStreak(history, { beforeWeekId: '2026-W47', currentWeekMet: true })).toBe(4)
    expect(getWeeklyStreak(history, { beforeWeekId: '2026-W47', currentWeekMet: false })).toBe(3)
  })

  it('supports beforeWeekId / throughWeekId windows', () => {
    expect(getWeeklyStreak(history, { beforeWeekId: '2026-W42' })).toBe(0)
    expect(getWeeklyStreak(history, { throughWeekId: '2026-W42' })).toBe(1)
    expect(getWeeklyStreak(history, { throughWeekId: '2026-W40' })).toBe(1)
  })

  it('a justified week breaks the streak (v1 history)', () => {
    expect(getWeeklyStreak([s('2026-W01', 'completed'), s('2026-W02', 'justified')])).toBe(0)
  })

  it('season 2 starts at zero after missed v1 weeks', () => {
    expect(getWeeklyStreak([s('2026-W45', 'missed'), s('2026-W46', 'missed')], { beforeWeekId: '2026-W47' })).toBe(0)
  })

  it('handles empty input', () => {
    expect(getWeeklyStreak([])).toBe(0)
    expect(getWeeklyStreak(undefined, { currentWeekMet: true })).toBe(1)
  })
})

describe('getBestWeeklyStreak', () => {
  it('finds the longest run across neutral gaps', () => {
    const list = [
      s('2026-W01', 'completed'), s('2026-W02', 'completed'), s('2026-W03', 'missed'),
      s('2026-W04', 'completed'), s('2026-W05', 'rest'), s('2026-W06', 'completed'),
      s('2026-W07', 'completed', { lifeUsed: true }), s('2026-W08', 'missed'),
    ]
    expect(getBestWeeklyStreak(list)).toBe(3)
    expect(getBestWeeklyStreak([])).toBe(0)
  })
})

describe('lastDecidedWeeks', () => {
  it('returns newest non-neutral weeks first', () => {
    const list = [s('2026-W01', 'missed'), s('2026-W02', 'rest'), s('2026-W03', 'completed'), s('2026-W04', 'paused')]
    expect(lastDecidedWeeks(list, 2).map((x) => x.weekId)).toEqual(['2026-W03', '2026-W01'])
    expect(lastDecidedWeeks(list, 2, { beforeWeekId: '2026-W03' }).map((x) => x.weekId)).toEqual(['2026-W01'])
  })
})

describe('day streaks', () => {
  const w = (date) => ({ date })

  it('counts consecutive days ending today', () => {
    const list = [w('2026-11-18'), w('2026-11-19'), w('2026-11-20')]
    expect(getCurrentDayStreak(list, '2026-11-20')).toBe(3)
  })

  it('keeps yesterday as the head when nothing today yet', () => {
    const list = [w('2026-11-18'), w('2026-11-19')]
    expect(getCurrentDayStreak(list, '2026-11-20')).toBe(2)
    expect(getCurrentDayStreak(list, '2026-11-21')).toBe(0)
  })

  it('accepts plain date strings and dedupes', () => {
    expect(getCurrentDayStreak(['2026-11-20', '2026-11-20', '2026-11-19'], '2026-11-20')).toBe(2)
    expect(getCurrentDayStreak([], '2026-11-20')).toBe(0)
  })

  it('crosses month and DST boundaries', () => {
    const list = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']
    expect(getBestDayStreak(list)).toBe(7)
    expect(getCurrentDayStreak(list, '2026-04-05')).toBe(7)
  })

  it('finds the best run', () => {
    expect(getBestDayStreak([w('2026-01-01'), w('2026-01-02'), w('2026-01-05'), w('2026-01-06'), w('2026-01-07')])).toBe(3)
    expect(getBestDayStreak([])).toBe(0)
    expect(getBestDayStreak([w('2026-01-01')])).toBe(1)
  })
})

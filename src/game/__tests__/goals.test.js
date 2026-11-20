import { describe, it, expect } from 'vitest'
import {
  computeGoalProgress, getGoalState, getGoalDaysLeft, getGoalLengthDays, getGoalPace, findExpiredGoals, achievedBeforeHalf,
} from '../goals.js'
import { computeWeekClose } from '../week.js'

const base = { id: 'g', userId: 'user1', kind: 'auto', startDate: '2026-11-01', endDate: '2026-11-30', status: 'active' }
const workouts = [
  { userId: 'user1', date: '2026-10-31', duration: 60, calories: 500, exerciseType: ['Correr'] }, // before
  { userId: 'user1', date: '2026-11-01', duration: 30, calories: 200, exerciseType: ['Correr'] },
  { userId: 'user1', date: '2026-11-15', duration: 45, exerciseType: 'Yoga' }, // legacy string
  { userId: 'user1', date: '2026-11-30', duration: 20, calories: 100, exerciseType: ['Yoga', 'Correr'] },
  { userId: 'user2', date: '2026-11-10', duration: 90, exerciseType: ['Correr'] }, // someone else
  { userId: 'user1', date: '2026-12-01', duration: 50, exerciseType: ['Correr'] }, // after
]

describe('computeGoalProgress', () => {
  it('counts sessions, minutes and calories in range for the owner', () => {
    expect(computeGoalProgress({ ...base, metric: 'sessions', target: 3 }, { workouts })).toEqual({ current: 3, target: 3, ratio: 1, done: true })
    expect(computeGoalProgress({ ...base, metric: 'minutes', target: 200 }, { workouts })).toMatchObject({ current: 95, done: false })
    expect(computeGoalProgress({ ...base, metric: 'calories', target: 300 }, { workouts }).current).toBe(300)
  })

  it('filters by exercise type (string or array on the workout)', () => {
    expect(computeGoalProgress({ ...base, metric: 'sessions', exerciseType: 'Yoga', target: 8 }, { workouts }).current).toBe(2)
    expect(computeGoalProgress({ ...base, metric: 'sessions', exerciseType: 'Correr', target: 8 }, { workouts }).current).toBe(2)
  })

  it('counts distinct habit days in range', () => {
    const habitWeeks = [
      { userId: 'user1', weekId: '2026-W44', checks: { h: ['2026-10-31', '2026-11-01'] } },
      { userId: 'user1', weekId: '2026-W45', checks: { h: ['2026-11-03', '2026-11-03', '2026-11-04'], x: ['2026-11-05'] } },
      { userId: 'user2', weekId: '2026-W45', checks: { h: ['2026-11-06'] } },
    ]
    const p = computeGoalProgress({ ...base, metric: 'habit', habitId: 'h', target: 20 }, { habitWeeks })
    expect(p.current).toBe(3)
    expect(p.ratio).toBeCloseTo(0.15)
  })

  it('manual goals use stored progress', () => {
    expect(computeGoalProgress({ ...base, kind: 'manual', target: 100, unit: 'km', progress: 64 })).toMatchObject({ current: 64, ratio: 0.64, done: false })
    expect(computeGoalProgress({ ...base, kind: 'manual', target: 4, progress: 5 })).toMatchObject({ ratio: 1, done: true })
    expect(computeGoalProgress({ ...base, kind: 'manual', target: 0 }).done).toBe(false)
  })
})

describe('getGoalState', () => {
  const p = (done) => ({ done })
  it('derives state with stored statuses taking priority', () => {
    expect(getGoalState({ ...base, status: 'cancelled' }, p(true), '2026-11-10')).toBe('cancelled')
    expect(getGoalState({ ...base, status: 'achieved' }, p(false), '2026-12-10')).toBe('achieved')
    expect(getGoalState({ ...base, status: 'missed' }, p(true), '2026-12-10')).toBe('missed')
    expect(getGoalState(base, p(true), '2026-11-10')).toBe('achieved')
    expect(getGoalState(base, p(false), '2026-11-30')).toBe('active')
    expect(getGoalState(base, p(false), '2026-12-01')).toBe('missed')
  })
})

describe('days and pace', () => {
  it('days left and length', () => {
    expect(getGoalLengthDays(base)).toBe(30)
    expect(getGoalDaysLeft(base, '2026-11-30')).toBe(1)
    expect(getGoalDaysLeft(base, '2026-11-21')).toBe(10)
    expect(getGoalDaysLeft(base, '2026-12-01')).toBe(0)
    expect(getGoalDaysLeft(base, '2026-10-01')).toBe(30)
  })

  it('pace', () => {
    const pace = getGoalPace(base, { current: 4, target: 12, done: false }, '2026-11-15')
    expect(pace.elapsedRatio).toBeCloseTo(0.5)
    expect(pace.expected).toBeCloseTo(6)
    expect(pace.onTrack).toBe(false)
    expect(pace.perDayNeeded).toBeCloseTo(8 / 16)
    expect(getGoalPace(base, { current: 12, target: 12, done: true }, '2026-11-15')).toMatchObject({ onTrack: true, perDayNeeded: 0 })
  })

  it('achievedBeforeHalf', () => {
    expect(achievedBeforeHalf({ ...base, achievedAt: new Date(2026, 10, 10).getTime() })).toBe(true)
    expect(achievedBeforeHalf({ ...base, achievedAt: { toMillis: () => new Date(2026, 10, 25).getTime() } })).toBe(false)
    expect(achievedBeforeHalf(base)).toBe(false)
  })
})

describe('findExpiredGoals + week close', () => {
  const goals = [
    { ...base, id: 'expired', metric: 'sessions', target: 10, endDate: '2026-11-22' },
    { ...base, id: 'doneButActive', metric: 'sessions', target: 1, endDate: '2026-11-22' },
    { ...base, id: 'future', metric: 'sessions', target: 10, endDate: '2026-11-23' },
    { ...base, id: 'cancelled', metric: 'sessions', target: 10, endDate: '2026-11-20', status: 'cancelled' },
    { ...base, id: 'noStatus', kind: 'manual', target: 5, endDate: '2026-11-16', status: undefined },
  ]
  it('finds active, unmet goals that ended by the date', () => {
    expect(findExpiredGoals(goals, { workouts, throughDate: '2026-11-22' }).map((g) => g.id)).toEqual(['expired', 'noStatus'])
  })

  it('computeWeekClose returns goalUpdates for goals ending by the closed Sunday', () => {
    const out = computeWeekClose({ weekId: '2026-W47', userIds: ['user1'], users: [{ id: 'user1' }], workouts, goals })
    expect(out.goalUpdates).toEqual([
      { goalId: 'expired', data: { status: 'missed' } },
      { goalId: 'noStatus', data: { status: 'missed' } },
    ])
    expect(computeWeekClose({ weekId: '2026-W47', userIds: ['user1'], users: [], workouts }).goalUpdates).toEqual([])
  })
})

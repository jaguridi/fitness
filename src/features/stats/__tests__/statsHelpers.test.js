import { describe, it, expect } from 'vitest'
import {
  formatMetric, weeklyMetricSeries, niceMax, activityLevel, buildHeatmap, previousMonthId, monthLabel, topSports,
} from '../statsHelpers.js'

describe('formatMetric', () => {
  it('pluralizes and uses Chilean number format', () => {
    expect(formatMetric('sessions', 1)).toBe('1 sesión')
    expect(formatMetric('sessions', 3)).toBe('3 sesiones')
    expect(formatMetric('minutes', 1240)).toBe('1.240 min')
    expect(formatMetric('calories', 300)).toBe('300 kcal')
    expect(formatMetric('points', 12.5)).toBe('12,5 puntos')
    expect(formatMetric('points', 2, { short: true })).toBe('2 pts')
    expect(formatMetric('streak', 1)).toBe('1 semana')
  })
})

describe('weeklyMetricSeries', () => {
  const ws = [
    { weekId: '2026-W46', duration: 30, calories: 200 },
    { weekId: '2026-W46', duration: 50 },
    { date: '2026-11-18', duration: 100 }, // W47 by date
    { weekId: '2026-W30', duration: 40 }, // outside the window
  ]
  const weeks = ['2026-W46', '2026-W47']
  it('sums per week', () => {
    expect(weeklyMetricSeries(ws, weeks, 'sessions')).toEqual([{ weekId: '2026-W46', value: 2 }, { weekId: '2026-W47', value: 1 }])
    expect(weeklyMetricSeries(ws, weeks, 'minutes').map((x) => x.value)).toEqual([80, 100])
    expect(weeklyMetricSeries(ws, weeks, 'calories').map((x) => x.value)).toEqual([200, 0])
    expect(weeklyMetricSeries(ws, weeks, 'points').map((x) => x.value)).toEqual([2.5, 2.5])
  })
})

describe('niceMax', () => {
  it('rounds to friendly bounds', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(3)).toBe(3)
    expect(niceMax(137)).toBe(200)
    expect(niceMax(240)).toBe(250)
    expect(niceMax(1000)).toBe(1000)
  })
})

describe('heatmap', () => {
  it('levels by minutes', () => {
    expect(activityLevel(undefined)).toBe(0)
    expect(activityLevel({ sessions: 1, minutes: 10 })).toBe(1)
    expect(activityLevel({ sessions: 1, minutes: 45 })).toBe(2)
    expect(activityLevel({ sessions: 2, minutes: 95 })).toBe(4)
  })
  it('builds columns Monday-first and marks the future', () => {
    const h = buildHeatmap({ '2026-11-16': { sessions: 1, minutes: 60 } }, '2026-W47', 3, '2026-11-18')
    expect(h.columns.map((c) => c.weekId)).toEqual(['2026-W45', '2026-W46', '2026-W47'])
    const last = h.columns[2].days
    expect(last[0]).toMatchObject({ date: '2026-11-16', level: 3, future: false })
    expect(last[3].future).toBe(true)
    expect(h.activeDays).toBe(1)
    expect(h.totalDays).toBe(14 + 3)
  })
})

describe('months', () => {
  it('previous month, across years', () => {
    expect(previousMonthId('2026-11-20')).toBe('2026-10')
    expect(previousMonthId('2027-01-03')).toBe('2026-12')
  })
  it('labels in Spanish', () => {
    expect(monthLabel('2026-10')).toBe('octubre')
    expect(monthLabel('2026-10', { withYear: true })).toBe('octubre de 2026')
  })
})

describe('topSports', () => {
  it('folds the tail into "Otros"', () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ type: `t${i}`, sessions: 8 - i, minutes: 10 }))
    const top = topSports(list, 5)
    expect(top).toHaveLength(6)
    expect(top[5]).toMatchObject({ type: 'Otros (3)', sessions: 6, minutes: 30, other: true })
    expect(topSports(list.slice(0, 6), 5)).toHaveLength(6)
  })
})

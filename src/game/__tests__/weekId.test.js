import { describe, it, expect } from 'vitest'
import { startOfWeek, addWeeks, endOfWeek } from 'date-fns'
import {
  getWeekId,
  getWeekRange,
  getPreviousWeekId,
  getNextWeekId,
  getWeeksBetween,
  getRecoveryWindow,
  getAdjacentWeeks,
  isDateInWeek,
} from '../weekId.js'

// ── Reference implementation ─────────────────────────────────────────
// Copy of the original date-fns version this module replaced. The pure
// implementation must match it for every date — stored weekIds depend on it.

function referenceGetWeekId(date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const year = weekStart.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const jan1Monday = new Date(year, 0, 1 + (1 - jan1Day))
  const diff = weekStart - jan1Monday
  const weekNum = Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

function referenceGetWeekRange(weekId) {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const firstMonday = new Date(year, 0, 1 + (1 - jan1Day))
  const weekStart = addWeeks(firstMonday, week - 1)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return { start: weekStart, end: weekEnd }
}

describe('getWeekId', () => {
  it('matches the original date-fns implementation for every day 2024–2027', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2027, 11, 31)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const probe = new Date(d)
      expect(getWeekId(probe), `for ${probe.toDateString()}`).toBe(referenceGetWeekId(probe))
    }
  })

  it('parses ISO date strings as local dates', () => {
    expect(getWeekId('2026-06-09')).toBe(getWeekId(new Date(2026, 5, 9)))
    expect(getWeekId('2026-06-08T12:00:00')).toBe(getWeekId(new Date(2026, 5, 8, 12)))
  })

  it('gives the same id for every day of the same week', () => {
    // Mon 2026-06-08 through Sun 2026-06-14
    const ids = []
    for (let day = 8; day <= 14; day++) ids.push(getWeekId(new Date(2026, 5, day)))
    expect(new Set(ids).size).toBe(1)
  })
})

describe('getWeekRange', () => {
  it('matches the original implementation across year boundaries', () => {
    for (const weekId of ['2025-W01', '2025-W53', '2026-W02', '2026-W23', '2027-W01']) {
      const ours = getWeekRange(weekId)
      const ref = referenceGetWeekRange(weekId)
      expect(ours.start.getTime(), `${weekId} start`).toBe(ref.start.getTime())
      expect(ours.end.getTime(), `${weekId} end`).toBe(ref.end.getTime())
    }
  })

  it('round-trips with getWeekId', () => {
    let cursor = '2025-W40'
    for (let i = 0; i < 40; i++) {
      const { start } = getWeekRange(cursor)
      expect(getWeekId(start)).toBe(cursor)
      cursor = getNextWeekId(cursor)
    }
  })
})

describe('getPreviousWeekId / getNextWeekId', () => {
  it('are inverses across the 2025→2026 year boundary', () => {
    // 2026 starts on Thursday: the sequence skips 2026-W01 by design.
    let cursor = '2025-W50'
    for (let i = 0; i < 10; i++) {
      const next = getNextWeekId(cursor)
      expect(getPreviousWeekId(next)).toBe(cursor)
      cursor = next
    }
    expect(getNextWeekId('2025-W53')).toBe('2026-W02')
    expect(getPreviousWeekId('2026-W02')).toBe('2025-W53')
  })
})

describe('getWeeksBetween', () => {
  it('returns an inclusive chronological list', () => {
    expect(getWeeksBetween('2026-W10', '2026-W13')).toEqual([
      '2026-W10', '2026-W11', '2026-W12', '2026-W13',
    ])
  })

  it('handles a single-week range', () => {
    expect(getWeeksBetween('2026-W10', '2026-W10')).toEqual(['2026-W10'])
  })

  it('returns [] for missing endpoints', () => {
    expect(getWeeksBetween(null, '2026-W10')).toEqual([])
    expect(getWeeksBetween('2026-W10', null)).toEqual([])
  })
})

describe('getRecoveryWindow', () => {
  it('pads ±3 weeks around the frozen range', () => {
    const window = getRecoveryWindow('2026-W10', '2026-W11', 3)
    expect(window).toEqual([
      '2026-W07', '2026-W08', '2026-W09',
      '2026-W10', '2026-W11',
      '2026-W12', '2026-W13', '2026-W14',
    ])
  })

  it('crosses year boundaries without producing phantom weeks', () => {
    const window = getRecoveryWindow('2025-W52', '2026-W02', 3)
    // Every consecutive pair must be linked by getNextWeekId.
    for (let i = 1; i < window.length; i++) {
      expect(getNextWeekId(window[i - 1])).toBe(window[i])
    }
    expect(window).toContain('2025-W53')
    expect(window).toContain('2026-W02')
    expect(window).not.toContain('2026-W01') // skipped id, must never appear
  })
})

describe('getAdjacentWeeks', () => {
  it('returns before+after neighbors excluding the week itself', () => {
    const weeks = getAdjacentWeeks('2026-W23', 2, 2)
    expect(weeks).toEqual(['2026-W21', '2026-W22', '2026-W24', '2026-W25'])
  })
})

describe('isDateInWeek', () => {
  it('includes Monday 00:00 through Sunday 23:59', () => {
    expect(isDateInWeek(new Date(2026, 5, 8, 0, 0), '2026-W24')).toBe(true)
    expect(isDateInWeek(new Date(2026, 5, 14, 23, 59), '2026-W24')).toBe(true)
    expect(isDateInWeek(new Date(2026, 5, 15, 0, 0), '2026-W24')).toBe(false)
  })
})

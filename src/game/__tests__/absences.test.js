import { describe, it, expect } from 'vitest'
import {
  isLegacyAbsence,
  getFrozenWeeksMap,
  getAbsenceRecoveryWindow,
  simulateAutoRecovery,
  computeWeekRequirements,
  computeSessionsJustified,
} from '../absences.js'
import { WEEKLY_GOAL } from '../constants.js'

const U = 'user1'

describe('absence schema helpers', () => {
  it('detects legacy vs new format', () => {
    expect(isLegacyAbsence({ frozenWeekId: '2026-W10' })).toBe(true)
    expect(isLegacyAbsence({ frozenWeeks: { '2026-W10': 3 } })).toBe(false)
  })

  it('normalizes legacy absences to a frozenWeeks map', () => {
    expect(getFrozenWeeksMap({ frozenWeekId: '2026-W10', frozenSessions: 2 }))
      .toEqual({ '2026-W10': 2 })
    // Legacy without explicit count freezes the whole goal
    expect(getFrozenWeeksMap({ frozenWeekId: '2026-W10' }))
      .toEqual({ '2026-W10': WEEKLY_GOAL })
    expect(getFrozenWeeksMap({ frozenWeeks: { '2026-W10': 3, '2026-W11': 3 } }))
      .toEqual({ '2026-W10': 3, '2026-W11': 3 })
  })

  it('builds the ±3 recovery window around the frozen range', () => {
    const a = { userId: U, frozenWeeks: { '2026-W10': 3, '2026-W11': 3 } }
    const window = getAbsenceRecoveryWindow(a)
    expect(window[0]).toBe('2026-W07')
    expect(window[window.length - 1]).toBe('2026-W14')
    expect(window).toHaveLength(8)
  })
})

describe('computeWeekRequirements', () => {
  it('returns the plain goal with no absences', () => {
    expect(computeWeekRequirements(U, '2026-W10', [])).toMatchObject({
      recoverySessions: 0,
      frozenSessions: 0,
      totalRequired: WEEKLY_GOAL,
      fullyFrozen: false,
      inRecoveryWindow: false,
    })
  })

  it('fully freezes a week covered by a new-format absence', () => {
    const absences = [{ id: 'a1', userId: U, frozenWeeks: { '2026-W10': 3 } }]
    expect(computeWeekRequirements(U, '2026-W10', absences)).toMatchObject({
      frozenSessions: 3,
      totalRequired: 0,
      fullyFrozen: true,
    })
  })

  it('supports partial freezes', () => {
    const absences = [{ id: 'a1', userId: U, frozenWeeks: { '2026-W10': 2 } }]
    expect(computeWeekRequirements(U, '2026-W10', absences)).toMatchObject({
      frozenSessions: 2,
      totalRequired: 1,
      fullyFrozen: false,
    })
  })

  it('adds legacy recovery sessions to the goal', () => {
    const absences = [{
      id: 'a1',
      userId: U,
      frozenWeekId: '2026-W08',
      frozenSessions: 3,
      recoveryWeeks: ['2026-W10'],
      missedSessionsPerRecoveryWeek: { '2026-W10': 2 },
    }]
    expect(computeWeekRequirements(U, '2026-W10', absences)).toMatchObject({
      recoverySessions: 2,
      totalRequired: WEEKLY_GOAL + 2,
    })
  })

  it('ignores other users’ absences', () => {
    const absences = [{ id: 'a1', userId: 'user2', frozenWeeks: { '2026-W10': 3 } }]
    expect(computeWeekRequirements(U, '2026-W10', absences).totalRequired).toBe(WEEKLY_GOAL)
  })

  it('flags weeks inside an active recovery window', () => {
    const absences = [{ id: 'a1', userId: U, frozenWeeks: { '2026-W10': 3 } }]
    expect(computeWeekRequirements(U, '2026-W12', absences).inRecoveryWindow).toBe(true)
    expect(computeWeekRequirements(U, '2026-W12', [{ ...absences[0], status: 'closed' }])
      .inRecoveryWindow).toBe(false)
  })
})

describe('simulateAutoRecovery', () => {
  it('consumes extras FIFO inside the window, skipping frozen weeks', () => {
    const a = { id: 'a1', userId: U, frozenWeeks: { '2026-W10': 3 } }
    const sessions = {
      [U]: {
        '2026-W08': 5, // 2 extras (before the freeze)
        '2026-W10': 4, // frozen week itself — must be skipped
        '2026-W12': 4, // 1 extra
      },
    }
    const r = simulateAutoRecovery([a], sessions)
    expect(r.debtConsumedPerAbsenceWeek.a1).toEqual({ '2026-W08': 2, '2026-W12': 1 })
    expect(r.remainingDebtByAbsence.a1).toBe(0)
    expect(r.debtConsumedByUserWeek[U]).toEqual({ '2026-W08': 2, '2026-W12': 1 })
  })

  it('reports remaining debt when extras don’t cover it', () => {
    const a = { id: 'a1', userId: U, frozenWeeks: { '2026-W10': 3, '2026-W11': 3 } }
    const sessions = { [U]: { '2026-W12': 5 } } // only 2 extras for 6 of debt
    const r = simulateAutoRecovery([a], sessions)
    expect(r.remainingDebtByAbsence.a1).toBe(4)
  })

  it('shares per-week extras across absences without double counting', () => {
    const a1 = { id: 'a1', userId: U, frozenWeeks: { '2026-W10': 1 }, createdAt: { seconds: 100 } }
    const a2 = { id: 'a2', userId: U, frozenWeeks: { '2026-W11': 2 }, createdAt: { seconds: 200 } }
    const sessions = { [U]: { '2026-W12': 5 } } // 2 extras total
    const r = simulateAutoRecovery([a1, a2], sessions)
    // FIFO: a1 (older) takes 1 extra, a2 gets the single remaining one
    expect(r.debtConsumedPerAbsenceWeek.a1).toEqual({ '2026-W12': 1 })
    expect(r.debtConsumedPerAbsenceWeek.a2).toEqual({ '2026-W12': 1 })
    expect(r.remainingDebtByAbsence.a1).toBe(0)
    expect(r.remainingDebtByAbsence.a2).toBe(1)
    // Combined per-user ledger never exceeds the actual extras
    expect(r.debtConsumedByUserWeek[U]['2026-W12']).toBe(2)
  })

  it('ignores legacy and closed absences', () => {
    const legacy = { id: 'L', userId: U, frozenWeekId: '2026-W10' }
    const closed = { id: 'C', userId: U, frozenWeeks: { '2026-W10': 3 }, status: 'closed' }
    const r = simulateAutoRecovery([legacy, closed], { [U]: { '2026-W12': 9 } })
    expect(r.remainingDebtByAbsence).toEqual({})
  })
})

describe('computeSessionsJustified', () => {
  const week = '2026-W10'

  it('sums approved and pending-vote justifications', () => {
    const js = [
      { userId: U, weekId: week, aiVerdict: true, sessionsJustified: 1 },
      { userId: U, weekId: week, status: 'pending_vote', sessionsJustified: 1 },
      { userId: U, weekId: week, aiVerdict: false, sessionsJustified: 3 }, // rejected
      { userId: 'user2', weekId: week, aiVerdict: true, sessionsJustified: 3 }, // other user
    ]
    expect(computeSessionsJustified(U, week, js)).toBe(2)
  })

  it('treats legacy justifications without sessionsJustified as a full week', () => {
    const js = [{ userId: U, weekId: week, aiVerdict: true }]
    expect(computeSessionsJustified(U, week, js)).toBe(WEEKLY_GOAL)
  })
})

import { describe, it, expect } from 'vitest'
import { computeWeekRequirements, getAbsenceRecoveryWindow, simulateAutoRecovery } from '../absences.js'
import { computeWeekEndOutcome } from '../weekEnd.js'
import { getWeekId } from '../weekId.js'
import { getHoliday } from '../holidays.js'

const WEEK = '2026-W38'
const user = { id: 'user1', walletBalance: 5000, currentFineLevel: 10000,
  extraLives: 2, consecutiveMisses: 0, consecutiveSuccesses: 3, hasShield: true, bankedExtras: 0 }
const absence = { id: 'a1', userId: user.id, status: 'active', frozenWeeks: { '2026-W35': 2 } }

function close(count, absences = [], bankedExtras = 0) {
  return computeWeekEndOutcome({ weekId: WEEK, userIds: [user.id], users: [{ ...user, bankedExtras }],
    absences, weekWorkouts: Array.from({ length: count }, () => ({ userId: user.id, weekId: WEEK })),
    weekJustifications: [], sessionsByUserWeek: { [user.id]: { [WEEK]: count } } })
}

describe('agreed Fiestas Patrias holiday', () => {
  it('covers only 14–20 September 2026 and requires no sessions', () => {
    expect(getWeekId('2026-09-14')).toBe(WEEK)
    expect(getWeekId('2026-09-20')).toBe(WEEK)
    expect(computeWeekRequirements(user.id, WEEK, []).totalRequired).toBe(0)
    expect(computeWeekRequirements(user.id, '2026-W39', []).totalRequired).toBe(3)
    expect(getHoliday('2027-W38')).toBeNull()
  })

  it('does not penalize rest or change streaks, fine level, shields or lives', () => {
    const out = close(0)
    const after = Object.assign({}, user, ...out.userUpdates.map((u) => u.data))
    expect(after).toEqual(user)
    expect(out.summaries[0].data).toMatchObject({ status: 'holiday', sessions: 0,
      fineApplied: 0, totalRequired: 0, lifeUsed: false, shieldBroken: false })
    expect(out.absenceUpdates).toEqual([])
  })

  it('credits the first workout to the oldest pending absence, once only', () => {
    const newer = { ...absence, id: 'a2', frozenWeeks: { '2026-W37': 2 }, createdAt: { seconds: 2 } }
    const old = { ...absence, createdAt: { seconds: 1 } }
    const sim = simulateAutoRecovery([newer, old], { [user.id]: { [WEEK]: 1 } })
    expect(sim.debtConsumedPerAbsenceWeek.a1[WEEK]).toBe(1)
    expect(sim.remainingDebtByAbsence).toEqual({ a1: 1, a2: 2 })
    const out = close(1, [old, newer])
    expect(out.summaries[0].data).toMatchObject({ debtConsumed: 1, extrasBanked: 0, fineApplied: 0 })
  })

  it('banks only workouts left over after recovery and preserves existing rewards', () => {
    const out = close(3, [absence])
    expect(out.summaries[0].data).toMatchObject({ debtConsumed: 2, extrasBanked: 1, lifeEarned: false })
    expect(out.userUpdates[0].data).toEqual({ walletBalance: 5000, bankedExtras: 1 })
  })

  it('keeps the normal redemption rule for unused holiday extras', () => {
    const out = close(1, [], 9)
    expect(out.userUpdates[0].data).toEqual({ walletBalance: 0, bankedExtras: 0 })
    expect(out.summaries[0].data).toMatchObject({ extrasRedeemed: 1, fineReducedByCanje: 5000 })
  })

  it('keeps the holiday available for recovery without using an active week of the deadline', () => {
    const window = getAbsenceRecoveryWindow(absence, [absence])
    expect(window).toContain(WEEK)
    expect(window.at(-1)).toBe('2026-W40')
    const endingOnHoliday = { ...absence, frozenWeeks: { '2026-W34': 2 } }
    const out = close(0, [endingOnHoliday])
    expect(getAbsenceRecoveryWindow(endingOnHoliday).at(-1)).toBe('2026-W39')
    expect(out.absenceUpdates).toEqual([])
  })

  it('retains holiday credit at later closes', () => {
    const out = computeWeekEndOutcome({ weekId: '2026-W40', userIds: [user.id], users: [user],
      absences: [absence], weekWorkouts: Array.from({ length: 3 }, () => ({ userId: user.id })),
      weekJustifications: [], sessionsByUserWeek: { [user.id]: { [WEEK]: 2, '2026-W40': 3 } } })
    expect(out.absenceUpdates[0].data).toMatchObject({ status: 'closed', debtUnpaid: 0, fineApplied: 0 })
  })
})

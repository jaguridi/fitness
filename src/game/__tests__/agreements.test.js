import { describe, it, expect } from 'vitest'
import {
  computeWeekRequirements, getAbsenceRecoveryWindow, isAbsenceRecoverySuspended, requiredSessionsForWeek,
} from '../absences.js'
import { computeWeekEndOutcome } from '../weekEnd.js'
import { getRecoveryWindow } from '../weekId.js'
import { getBonusWeek, getPause, PARTICIPATION_PAUSES } from '../holidays.js'

const base = { walletBalance: 4167, currentFineLevel: 10000, extraLives: 0,
  consecutiveMisses: 0, consecutiveSuccesses: 1, hasShield: false, bankedExtras: 0 }

function close(weekId, user, count, absences = [], sessionsByUserWeek = null, justifications = []) {
  return computeWeekEndOutcome({ weekId, userIds: [user.id], users: [user], absences,
    weekWorkouts: Array.from({ length: count }, () => ({ userId: user.id, weekId })),
    weekJustifications: justifications,
    sessionsByUserWeek: sessionsByUserWeek || { [user.id]: { [weekId]: count } } })
}

describe('W39 compensation week (Gonza and Fran)', () => {
  const gonza = { id: 'user3', ...base }

  it('requires nothing from Gonza and Fran only', () => {
    expect(getBonusWeek('user3', '2026-W39')).not.toBeNull()
    expect(getBonusWeek('user4', '2026-W39')).not.toBeNull()
    expect(computeWeekRequirements('user3', '2026-W39', []).totalRequired).toBe(0)
    expect(computeWeekRequirements('user4', '2026-W39', []).fullyFrozen).toBe(false)
    expect(computeWeekRequirements('user1', '2026-W39', []).totalRequired).toBe(3)
    expect(computeWeekRequirements('user3', '2026-W40', []).totalRequired).toBe(3)
    expect(requiredSessionsForWeek('user3', '2026-W39', [])).toBe(0)
  })

  it('turns every session into an extra that pays debt first, and still counts as met', () => {
    const absence = { id: 'a1', userId: 'user3', status: 'active', frozenWeeks: { '2026-W37': 2 } }
    const out = close('2026-W39', gonza, 3, [absence])
    expect(out.summaries[0].data).toMatchObject({ status: 'completed', totalRequired: 0,
      debtConsumed: 2, extrasBanked: 1, fineApplied: 0, bonusName: 'Compensación semana 39' })
    expect(out.userUpdates[0].data).toMatchObject({ bankedExtras: 1, currentFineLevel: 5000,
      consecutiveSuccesses: 2, walletBalance: 4167 })
  })
})

describe('participation pause (Javi, from W40 until further notice)', () => {
  const javi = { id: 'user2', ...base, walletBalance: 8334, currentFineLevel: 5000, consecutiveSuccesses: 0, hasShield: true }

  it('starts at W40 and has no end yet', () => {
    expect(getPause('user2', '2026-W39')).toBeNull()
    expect(getPause('user2', '2026-W40')).not.toBeNull()
    expect(getPause('user2', '2027-W10')).not.toBeNull()
    expect(getPause('user1', '2026-W40')).toBeNull()
    expect(computeWeekRequirements('user2', '2026-W40', [])).toMatchObject({
      paused: true, totalRequired: 0, fullyFrozen: true, frozenSessions: 0 })
  })

  it('leaves every stat untouched, with or without sessions', () => {
    for (const count of [0, 4]) {
      const out = close('2026-W40', javi, count)
      expect(out.userUpdates).toEqual([])
      expect(out.summaries[0].data).toMatchObject({ status: 'paused', sessions: count,
        fineApplied: 0, shieldBroken: false, extrasBanked: 0, debtConsumed: 0, bankedExtrasAfter: 0 })
      expect(out.absenceUpdates).toEqual([])
    }
  })

  it('stops the recovery clock: a window reaching the pause is suspended, never settled', () => {
    const absence = { id: 'a1', userId: 'user2', status: 'active', frozenWeeks: { '2026-W35': 2 } }
    expect(isAbsenceRecoverySuspended(absence, [absence])).toBe(true)
    const window = getAbsenceRecoveryWindow(absence, [absence])
    expect(window.at(-1)).toBe('2026-W39')
    expect(window.some((w) => w >= '2026-W40')).toBe(false)
    // Its last pre-pause week is not a deadline, nor is any paused week.
    expect(close('2026-W39', javi, 0, [absence]).absenceUpdates).toEqual([])
    expect(close('2026-W40', javi, 0, [absence]).absenceUpdates).toEqual([])
  })

  it('does not rescue an absence whose deadline came before the pause', () => {
    const absence = { id: 'a1', userId: 'user2', status: 'active', frozenWeeks: { '2026-W30': 1 } }
    expect(isAbsenceRecoverySuspended(absence, [absence])).toBe(false)
    const deadline = getAbsenceRecoveryWindow(absence, [absence]).at(-1)
    expect(deadline < '2026-W40').toBe(true)
    const out = close(deadline, javi, 3, [absence], { user2: { [deadline]: 3 } })
    expect(out.absenceUpdates[0].data).toMatchObject({ status: 'closed', debtUnpaid: 1 })
  })

  it('once ended, skips the paused weeks and resumes the deadline after them', () => {
    const pause = PARTICIPATION_PAUSES.find((p) => p.userId === 'user2')
    const absence = { id: 'a1', userId: 'user2', status: 'active', frozenWeeks: { '2026-W35': 2 } }
    try {
      pause.untilWeekId = '2026-W42'
      expect(getPause('user2', '2026-W43')).toBeNull()
      expect(isAbsenceRecoverySuspended(absence, [absence])).toBe(false)
      const window = getAbsenceRecoveryWindow(absence, [absence])
      expect(window).not.toContain('2026-W40')
      expect(window.at(-1)).toBe('2026-W43')
      const out = close('2026-W43', javi, 3, [absence], { user2: { '2026-W43': 3 } })
      expect(out.absenceUpdates[0].data).toMatchObject({ status: 'closed', debtUnpaid: 2 })
    } finally {
      pause.untilWeekId = null
    }
  })
})

describe('getRecoveryWindow openFrom', () => {
  it('stops the trailing walk at an open-ended skip', () => {
    expect(getRecoveryWindow('2026-W10', '2026-W10', 4, null, null, null, '2026-W12'))
      .toEqual(['2026-W06', '2026-W07', '2026-W08', '2026-W09', '2026-W10', '2026-W11'])
    expect(getRecoveryWindow('2026-W10', '2026-W10', 4, null, null, null, '2026-W20').at(-1)).toBe('2026-W14')
  })
})

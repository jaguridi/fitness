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

describe('W41 perdonazo masivo', () => {
  const W41 = '2026-W41'
  const jose = { ...user, walletBalance: 20833, currentFineLevel: 5000, extraLives: 0,
    consecutiveSuccesses: 0, hasShield: false }
  // Jose's real freezes: two settled (and forgiven) at the W41 close, one still open.
  const oldTrip = { id: 'wPUvg3', userId: 'user1', status: 'closed', frozenWeeks: { '2026-W29': 3, '2026-W30': 1 },
    extraRecoveryWeeks: 4, createdAt: { seconds: 1 }, debtUnpaid: 3, fineApplied: 0, forgivenWeekId: W41 }
  const w35 = { id: 'VhWccZ', userId: 'user1', status: 'closed', frozenWeeks: { '2026-W35': 3 },
    createdAt: { seconds: 2 }, debtUnpaid: 3, fineApplied: 0, forgivenWeekId: W41 }
  const w37 = { id: 'uo3ZXg', userId: 'user1', status: 'active', frozenWeeks: { '2026-W37': 2 }, createdAt: { seconds: 3 } }
  const all = [oldTrip, w35, w37]

  it('covers 5–11 October 2026 for everyone but keeps Javi paused', () => {
    expect(getWeekId('2026-10-05')).toBe(W41)
    expect(getWeekId('2026-10-11')).toBe(W41)
    expect(getHoliday(W41).name).toBe('Perdonazo masivo')
    for (const uid of ['user1', 'user3', 'user4']) expect(computeWeekRequirements(uid, W41, []).totalRequired).toBe(0)
    expect(computeWeekRequirements('user2', W41, []).paused).toBe(true)
    expect(computeWeekRequirements('user1', '2026-W44', []).totalRequired).toBe(3)
  })

  it('forgives a missed week without touching any stat', () => {
    const out = computeWeekEndOutcome({ weekId: W41, userIds: ['user1'], users: [jose], absences: all,
      weekWorkouts: [], weekJustifications: [], sessionsByUserWeek: { user1: {} } })
    expect(Object.assign({}, jose, ...out.userUpdates.map((u) => u.data))).toEqual(jose)
    expect(out.summaries[0].data).toMatchObject({ status: 'holiday', holidayName: 'Perdonazo masivo', fineApplied: 0 })
    expect(out.absenceUpdates).toEqual([])
  })

  it('keeps forgiven freezes from claiming extras on or after W41', () => {
    expect(getAbsenceRecoveryWindow(w35, all).at(-1)).toBe('2026-W40')
    expect(getAbsenceRecoveryWindow(oldTrip, all).every((w) => w < W41)).toBe(true)
    const sim = simulateAutoRecovery(all, { user1: { [W41]: 1, '2026-W42': 4 } })
    expect(sim.debtConsumedPerAbsenceWeek.uo3ZXg).toEqual({ [W41]: 1, '2026-W42': 1 })
    expect(sim.remainingDebtByAbsence.uo3ZXg).toBe(0)
    expect(sim.remainingDebtByAbsence.VhWccZ).toBe(3)
  })
})

describe("W42 perdonazo masivo and Javi's return", () => {
  const W42 = '2026-W42'
  const jose = { ...user, walletBalance: 20833, currentFineLevel: 5000, extraLives: 0,
    consecutiveSuccesses: 0, hasShield: false }
  const javi = { id: 'user2', walletBalance: 8334, currentFineLevel: 5000, extraLives: 0,
    consecutiveMisses: 0, consecutiveSuccesses: 0, hasShield: true, bankedExtras: 0 }
  const w37 = { id: 'uo3ZXg', userId: 'user1', status: 'active', frozenWeeks: { '2026-W37': 2 }, createdAt: { seconds: 3 } }
  // Javi's two old freezes, forgiven at her return instead of falling due in W43.
  const forgiven = { status: 'closed', fineApplied: 0, forgivenWeekId: W42 }
  const trip = { id: 'yY8ooM', userId: 'user2', frozenWeeks: { '2026-W29': 3, '2026-W30': 1 },
    extraRecoveryWeeks: 4, createdAt: { seconds: 1 }, debtUnpaid: 2, totalDebt: 4, ...forgiven }
  const w35 = { id: '0mKAUM', userId: 'user2', frozenWeeks: { '2026-W35': 2 },
    createdAt: { seconds: 2 }, debtUnpaid: 2, totalDebt: 2, ...forgiven }

  it('covers 12–18 October 2026 for everyone; Javi is paused until it ends', () => {
    expect(getWeekId('2026-10-12')).toBe(W42)
    expect(getWeekId('2026-10-18')).toBe(W42)
    expect(getHoliday(W42).name).toBe('Perdonazo masivo')
    for (const uid of ['user1', 'user3', 'user4']) expect(computeWeekRequirements(uid, W42, []).totalRequired).toBe(0)
    expect(computeWeekRequirements('user2', W42, []).paused).toBe(true)
    expect(computeWeekRequirements('user2', '2026-W43', []).paused).toBeFalsy()
  })

  it('forgives a missed week without touching any stat', () => {
    const out = computeWeekEndOutcome({ weekId: W42, userIds: ['user1'], users: [jose], absences: [w37],
      weekWorkouts: [], weekJustifications: [], sessionsByUserWeek: { user1: {} } })
    expect(Object.assign({}, jose, ...out.userUpdates.map((u) => u.data))).toEqual(jose)
    expect(out.summaries[0].data).toMatchObject({ status: 'holiday', holidayName: 'Perdonazo masivo', fineApplied: 0 })
    expect(out.absenceUpdates).toEqual([])
  })

  it("moves Jose's open W37 freeze deadline past W42 and W43, to W45", () => {
    expect(getAbsenceRecoveryWindow(w37, [w37]).at(-1)).toBe('2026-W45')
  })

  it('leaves Javi nothing to repay after her return', () => {
    for (const a of [trip, w35]) expect(getAbsenceRecoveryWindow(a, [trip, w35]).every((w) => w < W42)).toBe(true)
    const out = computeWeekEndOutcome({ weekId: '2026-W44', userIds: ['user2'], users: [javi], absences: [trip, w35],
      weekWorkouts: Array.from({ length: 3 }, () => ({ userId: 'user2', weekId: '2026-W44' })),
      weekJustifications: [], sessionsByUserWeek: { user2: { '2026-W44': 3 } } })
    expect(out.absenceUpdates).toEqual([])
    expect(out.summaries[0].data).toMatchObject({ status: 'completed', fineApplied: 0, debtConsumed: 0 })
  })
})

describe('W43 perdonazo masivo: sessions become extras', () => {
  const W43 = '2026-W43'
  const jose = { ...user, walletBalance: 20833, currentFineLevel: 5000, extraLives: 0,
    consecutiveSuccesses: 0, hasShield: false, bankedExtras: 0 }
  const javi = { id: 'user2', walletBalance: 8334, currentFineLevel: 5000, extraLives: 0,
    consecutiveMisses: 0, consecutiveSuccesses: 0, hasShield: true, bankedExtras: 0 }
  const w37 = { id: 'uo3ZXg', userId: 'user1', status: 'active', frozenWeeks: { '2026-W37': 2 }, createdAt: { seconds: 3 } }
  const close = (u, count, absences = []) => computeWeekEndOutcome({ weekId: W43, userIds: [u.id], users: [u], absences,
    weekWorkouts: Array.from({ length: count }, () => ({ userId: u.id, weekId: W43 })),
    weekJustifications: [], sessionsByUserWeek: { [u.id]: { [W43]: count } } })
  const after = (u, out) => Object.assign({}, u, ...out.userUpdates.map((x) => x.data))

  it('covers 19–25 October 2026 and requires nothing from anyone, Javi included', () => {
    expect(getWeekId('2026-10-19')).toBe(W43)
    expect(getWeekId('2026-10-25')).toBe(W43)
    expect(getHoliday(W43).name).toBe('Perdonazo masivo')
    for (const uid of ['user1', 'user2', 'user3', 'user4']) expect(computeWeekRequirements(uid, W43, []).totalRequired).toBe(0)
  })

  it("uses Jose's 2 sessions to repay his W37 freeze, touching no stat", () => {
    const out = close(jose, 2, [w37])
    expect(out.summaries[0].data).toMatchObject({ status: 'holiday', fineApplied: 0, debtConsumed: 2, extrasBanked: 0 })
    expect(after(jose, out)).toEqual(jose)
    expect(out.absenceUpdates).toEqual([])
    expect(simulateAutoRecovery([w37], { user1: { [W43]: 2 } }).remainingDebtByAbsence.uo3ZXg).toBe(0)
  })

  it("banks Javi's 2 sessions and keeps her shield", () => {
    const out = close(javi, 2)
    expect(out.summaries[0].data).toMatchObject({ status: 'holiday', fineApplied: 0, shieldBroken: false,
      debtConsumed: 0, extrasBanked: 2, bankedExtrasAfter: 2 })
    expect(after(javi, out)).toEqual({ ...javi, bankedExtras: 2 })
  })
})

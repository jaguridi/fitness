import { describe, it, expect } from 'vitest'
import { computeWeekEndOutcome, getSimulationWeeks } from '../weekEnd.js'
import {
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  EXTRAS_PER_FINE_REDEMPTION,
  FINE_REDEMPTION_AMOUNT,
} from '../constants.js'

const WEEK = '2026-W23'
const USER_IDS = ['user1', 'user2', 'user3', 'user4']

function freshUser(id, overrides = {}) {
  return {
    id,
    extraLives: 0,
    walletBalance: 0,
    bankedExtras: 0,
    currentFineLevel: BASE_FINE,
    consecutiveMisses: 0,
    consecutiveSuccesses: 0,
    hasShield: false,
    ...overrides,
  }
}

function workoutsFor(userId, count, weekId = WEEK) {
  return Array.from({ length: count }, (_, i) => ({ id: `${userId}-${i}`, userId, weekId }))
}

/** Run the close for a single user with sensible defaults. */
function close({ user, workouts = [], absences = [], justifications = [], sessionsByUserWeek }) {
  const outcome = computeWeekEndOutcome({
    weekId: WEEK,
    userIds: USER_IDS,
    users: [user],
    absences,
    weekWorkouts: workouts,
    weekJustifications: justifications,
    sessionsByUserWeek:
      sessionsByUserWeek ?? { [user.id]: { [WEEK]: workouts.filter((w) => w.userId === user.id).length } },
    nowIso: '2026-06-08T00:00:00.000Z',
  })
  const userUpdate = outcome.userUpdates.find((u) => u.userId === user.id)?.data
  const summary = outcome.summaries.find((s) => s.userId === user.id && s.weekId === WEEK)?.data
  return { outcome, userUpdate, summary }
}

describe('goal met', () => {
  it('marks completed, halves the fine level, and extends the streak', () => {
    const user = freshUser('user1', { currentFineLevel: 20000, consecutiveSuccesses: 1 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 3) })
    expect(summary.status).toBe('completed')
    expect(summary.fineApplied).toBe(0)
    expect(userUpdate.currentFineLevel).toBe(10000)
    expect(userUpdate.consecutiveSuccesses).toBe(2)
    expect(userUpdate.consecutiveMisses).toBe(0)
  })

  it('never drops the fine level below BASE_FINE', () => {
    const user = freshUser('user1')
    const { userUpdate } = close({ user, workouts: workoutsFor('user1', 3) })
    expect(userUpdate.currentFineLevel).toBe(BASE_FINE)
  })

  it('awards the shield on the 4th consecutive success', () => {
    const user = freshUser('user1', { consecutiveSuccesses: 3 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 3) })
    expect(userUpdate.hasShield).toBe(true)
    expect(summary.shieldEarned).toBe(true)
  })

  it('awards an extra life at EXTRA_LIFE_THRESHOLD sessions', () => {
    const user = freshUser('user1')
    const { userUpdate, summary } = close({
      user,
      workouts: workoutsFor('user1', EXTRA_LIFE_THRESHOLD),
    })
    expect(userUpdate.extraLives).toBe(1)
    expect(summary.lifeEarned).toBe(true)
  })
})

describe('goal missed', () => {
  it('applies the fine and doubles the level (capped at MAX_FINE)', () => {
    const user = freshUser('user1', { currentFineLevel: 20000, consecutiveSuccesses: 5 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 1) })
    expect(summary.status).toBe('missed')
    expect(summary.fineApplied).toBe(20000)
    expect(userUpdate.walletBalance).toBe(20000)
    expect(userUpdate.currentFineLevel).toBe(40000)
    expect(userUpdate.consecutiveSuccesses).toBe(0)
    expect(userUpdate.consecutiveMisses).toBe(1)

    // Next miss stays capped
    const again = close({
      user: freshUser('user1', { currentFineLevel: 40000 }),
      workouts: [],
    })
    expect(again.userUpdate.currentFineLevel).toBe(MAX_FINE)
  })

  it('the shield halves the fine and breaks', () => {
    const user = freshUser('user1', { currentFineLevel: 20000, hasShield: true })
    const { userUpdate, summary } = close({ user, workouts: [] })
    expect(summary.fineApplied).toBe(10000)
    expect(summary.shieldBroken).toBe(true)
    expect(userUpdate.hasShield).toBe(false)
    expect(userUpdate.currentFineLevel).toBe(40000)
  })

  it('a life covers a 1-session deficit and counts as a success', () => {
    const user = freshUser('user1', { extraLives: 2, currentFineLevel: 10000 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 2) })
    expect(summary.status).toBe('completed')
    expect(summary.lifeUsed).toBe(true)
    expect(summary.fineApplied).toBe(0)
    expect(userUpdate.extraLives).toBe(1)
    expect(userUpdate.currentFineLevel).toBe(BASE_FINE)
    expect(userUpdate.consecutiveSuccesses).toBe(1)
  })

  it('a life does NOT cover a 2-session deficit', () => {
    const user = freshUser('user1', { extraLives: 1 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 1) })
    expect(summary.status).toBe('missed')
    expect(userUpdate.extraLives).toBe(1) // untouched
    expect(summary.fineApplied).toBe(BASE_FINE)
  })
})

describe('justifications', () => {
  it('a full justification avoids the fine but resets the streak', () => {
    const user = freshUser('user1', { consecutiveSuccesses: 3, currentFineLevel: 10000 })
    const { userUpdate, summary } = close({
      user,
      workouts: [],
      justifications: [{ userId: 'user1', weekId: WEEK, aiVerdict: true, sessionsJustified: 3 }],
    })
    expect(summary.status).toBe('justified')
    expect(summary.fineApplied).toBe(0)
    expect(userUpdate.consecutiveSuccesses).toBe(0)
    expect(userUpdate.currentFineLevel).toBe(10000) // unchanged: not a success either
  })

  it('a partial justification still fines the uncovered deficit', () => {
    const user = freshUser('user1')
    const { summary } = close({
      user,
      workouts: [],
      justifications: [{ userId: 'user1', weekId: WEEK, aiVerdict: true, sessionsJustified: 1 }],
    })
    expect(summary.status).toBe('missed')
    expect(summary.effectiveDeficit).toBe(2)
    expect(summary.fineApplied).toBe(BASE_FINE)
  })

  it('justification + life combine to cover the deficit', () => {
    const user = freshUser('user1', { extraLives: 1 })
    // 1 session done, 1 justified, deficit 2 → effective 1 → life saves it
    const { summary, userUpdate } = close({
      user,
      workouts: workoutsFor('user1', 1),
      justifications: [{ userId: 'user1', weekId: WEEK, aiVerdict: true, sessionsJustified: 1 }],
    })
    expect(summary.lifeUsed).toBe(true)
    expect(summary.fineApplied).toBe(0)
    expect(userUpdate.extraLives).toBe(0)
  })
})

describe('frozen weeks', () => {
  it('a fully frozen week writes a frozen summary and leaves the user untouched', () => {
    const user = freshUser('user1', { walletBalance: 12345, consecutiveSuccesses: 2 })
    const { outcome, summary } = close({
      user,
      workouts: [],
      absences: [{ id: 'a1', userId: 'user1', frozenWeeks: { [WEEK]: 3 } }],
    })
    expect(summary.status).toBe('frozen')
    expect(summary.totalRequired).toBe(0)
    expect(outcome.userUpdates.find((u) => u.userId === 'user1')).toBeUndefined()
  })

  it('a partial freeze lowers the requirement', () => {
    const user = freshUser('user1')
    const { summary } = close({
      user,
      workouts: workoutsFor('user1', 1),
      absences: [{ id: 'a1', userId: 'user1', frozenWeeks: { [WEEK]: 2 } }],
    })
    expect(summary.status).toBe('completed')
    expect(summary.totalRequired).toBe(1)
  })
})

describe('extras bank', () => {
  it('banks extras beyond the goal on successful weeks', () => {
    const user = freshUser('user1', { bankedExtras: 3 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 5) })
    expect(summary.extrasBanked).toBe(2)
    expect(userUpdate.bankedExtras).toBe(5)
  })

  it('does not bank extras on missed weeks', () => {
    const user = freshUser('user1', { bankedExtras: 9 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 1) })
    expect(summary.extrasBanked).toBe(0)
    expect(userUpdate.bankedExtras).toBe(9)
  })

  it('redeems a batch against a pending fine', () => {
    const user = freshUser('user1', {
      bankedExtras: EXTRAS_PER_FINE_REDEMPTION - 1,
      walletBalance: 20000,
    })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 4) })
    expect(summary.extrasRedeemed).toBe(1)
    expect(summary.fineReducedByCanje).toBe(FINE_REDEMPTION_AMOUNT)
    expect(userUpdate.walletBalance).toBe(20000 - FINE_REDEMPTION_AMOUNT)
    expect(userUpdate.bankedExtras).toBe(0)
  })

  it('keeps banking without redemption when there is no pending fine', () => {
    const user = freshUser('user1', { bankedExtras: 12, walletBalance: 0 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 3) })
    expect(summary.extrasRedeemed).toBe(0)
    expect(userUpdate.bankedExtras).toBe(12)
  })

  it('redeems multiple batches when the wallet allows it', () => {
    const user = freshUser('user1', { bankedExtras: 20, walletBalance: 40000 })
    const { userUpdate, summary } = close({ user, workouts: workoutsFor('user1', 3) })
    expect(summary.extrasRedeemed).toBe(2)
    expect(userUpdate.walletBalance).toBe(40000 - 2 * FINE_REDEMPTION_AMOUNT)
    expect(userUpdate.bankedExtras).toBe(0)
  })
})

describe('debt consumption interactions', () => {
  // An absence frozen 2 weeks ago, with this week's extras paying its debt.
  function debtScenario(sessionsThisWeek) {
    const absence = { id: 'a1', userId: 'user1', frozenWeeks: { '2026-W21': 3 } }
    return {
      user: freshUser('user1'),
      workouts: workoutsFor('user1', sessionsThisWeek),
      absences: [absence],
      sessionsByUserWeek: { user1: { [WEEK]: sessionsThisWeek } },
    }
  }

  it('extras consumed by debt do not earn a life or bank extras', () => {
    // 6 sessions: 3 for the goal + 3 consumed by debt → no life (threshold 5), no bank
    const { userUpdate, summary } = close(debtScenario(6))
    expect(summary.debtConsumed).toBe(3)
    expect(summary.lifeEarned).toBe(false)
    expect(summary.extrasBanked).toBe(0)
    expect(userUpdate.bankedExtras).toBe(0)
  })

  it('sessions beyond goal+debt still count toward life and bank', () => {
    // 9 sessions: 3 goal + 3 debt + 3 genuinely extra → life earned (6 ≥ 5), 3 banked
    const { userUpdate, summary } = close(debtScenario(9))
    expect(summary.debtConsumed).toBe(3)
    expect(summary.lifeEarned).toBe(true)
    expect(summary.extrasBanked).toBe(3)
    expect(userUpdate.extraLives).toBe(1)
  })
})

describe('absence settlement', () => {
  // Window of a W19–W20 freeze ends exactly on WEEK (=W23).
  const FROZEN = { '2026-W19': 3, '2026-W20': 3 }

  function settlementScenario({ paidExtras, userOverrides = {} }) {
    const absence = { id: 'a1', userId: 'user1', frozenWeeks: FROZEN }
    const user = freshUser('user1', userOverrides)
    return computeWeekEndOutcome({
      weekId: WEEK,
      userIds: USER_IDS,
      users: [user],
      absences: [absence],
      weekWorkouts: workoutsFor('user1', 3),
      weekJustifications: [],
      sessionsByUserWeek: {
        user1: { '2026-W21': 3 + paidExtras, [WEEK]: 3 },
      },
      nowIso: '2026-06-08T00:00:00.000Z',
    })
  }

  it('closes cleanly when the debt was fully paid', () => {
    const outcome = settlementScenario({ paidExtras: 6 })
    const update = outcome.absenceUpdates.find((u) => u.absenceId === 'a1')
    expect(update.data).toMatchObject({ status: 'closed', debtUnpaid: 0, fineApplied: 0 })
    // No retroactive missed summaries
    expect(outcome.summaries.filter((s) => s.weekId === '2026-W19')).toHaveLength(0)
  })

  it('fines proportionally and marks frozen weeks missed when debt remains', () => {
    const outcome = settlementScenario({
      paidExtras: 2, // 4 of 6 debt remain
      userOverrides: { currentFineLevel: 10000 },
    })

    const update = outcome.absenceUpdates.find((u) => u.absenceId === 'a1')
    // fine = min(MAX, round(fineLevel(after this week's halving) * remaining / goal))
    // This week was completed → level halved to 5000 first; 5000*4/3 ≈ 6667
    expect(update.data.status).toBe('closed')
    expect(update.data.debtUnpaid).toBe(4)
    expect(update.data.fineApplied).toBe(Math.round((5000 * 4) / WEEKLY_GOAL))

    // Retroactive missed summaries on both frozen weeks, shares summing to the fine
    const w19 = outcome.summaries.find((s) => s.weekId === '2026-W19')
    const w20 = outcome.summaries.find((s) => s.weekId === '2026-W20')
    expect(w19.data.status).toBe('missed')
    expect(w20.data.status).toBe('missed')
    expect(w19.data.fineApplied + w20.data.fineApplied).toBe(update.data.fineApplied)

    // Wallet and escalation reflect the settlement on top of the weekly close
    const settlementUpdate = outcome.userUpdates.filter((u) => u.userId === 'user1').at(-1)
    expect(settlementUpdate.data.walletBalance).toBe(update.data.fineApplied)
    expect(settlementUpdate.data.consecutiveMisses).toBe(1)
    expect(settlementUpdate.data.consecutiveSuccesses).toBe(0)
  })

  it('does not settle before the window ends', () => {
    const absence = { id: 'a1', userId: 'user1', frozenWeeks: { '2026-W21': 3 } } // window ends W24
    const outcome = computeWeekEndOutcome({
      weekId: WEEK,
      userIds: USER_IDS,
      users: [freshUser('user1')],
      absences: [absence],
      weekWorkouts: workoutsFor('user1', 3),
      weekJustifications: [],
      sessionsByUserWeek: { user1: { [WEEK]: 3 } },
    })
    expect(outcome.absenceUpdates).toHaveLength(0)
  })
})

describe('getSimulationWeeks', () => {
  it('includes the closing week plus window weeks up to it', () => {
    const absence = { id: 'a1', userId: 'user1', frozenWeeks: { '2026-W21': 3 } }
    const weeks = getSimulationWeeks(WEEK, [absence])
    expect(weeks).toContain(WEEK)
    expect(weeks).toContain('2026-W18') // window start
    expect(weeks).not.toContain('2026-W24') // future weeks excluded
  })
})

describe('multi-user processing order', () => {
  it('processes every known user and skips missing docs', () => {
    const outcome = computeWeekEndOutcome({
      weekId: WEEK,
      userIds: USER_IDS,
      users: [freshUser('user1'), freshUser('user3')],
      absences: [],
      weekWorkouts: [...workoutsFor('user1', 3), ...workoutsFor('user3', 0)],
      weekJustifications: [],
      sessionsByUserWeek: { user1: { [WEEK]: 3 } },
    })
    expect(outcome.summaries.map((s) => s.userId)).toEqual(['user1', 'user3'])
    expect(outcome.summaries[0].data.status).toBe('completed')
    expect(outcome.summaries[1].data.status).toBe('missed')
  })
})

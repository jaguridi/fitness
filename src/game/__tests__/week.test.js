import { describe, it, expect } from 'vitest'
import { getWeeklyGoal, isRestWeek, computeMemberWeek, computeWeekClose, workoutWeekId } from '../week.js'
import { weekDates } from '../habits.js'
import { DEFAULT_WEEKLY_GOAL, V2_START_WEEK, USER_IDS } from '../constants.js'

const WK = '2026-W47' // Mon 2026-11-16 … Sun 2026-11-22
const D = weekDates(WK)

function wo(userId, date, extra = {}) {
  return { userId, date, weekId: workoutWeekId({ date }), duration: 30, ...extra }
}

describe('constants', () => {
  it('season 2 starts at W47 with a default goal of 3', () => {
    expect(V2_START_WEEK).toBe('2026-W47')
    expect(DEFAULT_WEEKLY_GOAL).toBe(3)
    expect(USER_IDS).toEqual(['user1', 'user2', 'user3', 'user4'])
  })
})

describe('getWeeklyGoal', () => {
  it('defaults to 3 and clamps to 1–7', () => {
    expect(getWeeklyGoal({})).toBe(3)
    expect(getWeeklyGoal(null)).toBe(3)
    expect(getWeeklyGoal({ weeklyGoal: 0 })).toBe(3)
    expect(getWeeklyGoal({ weeklyGoal: 'x' })).toBe(3)
    expect(getWeeklyGoal({ weeklyGoal: 5 })).toBe(5)
    expect(getWeeklyGoal({ weeklyGoal: 12 })).toBe(7)
    expect(getWeeklyGoal({ weeklyGoal: 2.4 })).toBe(2)
  })
})

describe('isRestWeek', () => {
  it('reads restWeeks', () => {
    expect(isRestWeek({ restWeeks: [WK] }, WK)).toBe(true)
    expect(isRestWeek({ restWeeks: [] }, WK)).toBe(false)
    expect(isRestWeek({}, WK)).toBe(false)
  })
})

describe('computeMemberWeek', () => {
  const user = { id: 'user1', weeklyGoal: 3 }

  it('counts only this user and week, with minutes, calories and days', () => {
    const workouts = [
      wo('user1', D[0], { duration: 40, calories: 300 }),
      wo('user1', D[2], { duration: 20 }),
      wo('user2', D[2]),
      wo('user1', '2026-11-10'), // previous week
    ]
    const r = computeMemberWeek({ user, weekId: WK, workouts, currentWeekId: WK, today: D[4] })
    expect(r.sessions).toBe(2)
    expect(r.minutes).toBe(60)
    expect(r.calories).toBe(300)
    expect(r.goal).toBe(3)
    expect(r.met).toBe(false)
    expect(r.status).toBe('in_progress')
    expect(r.remaining).toBe(1)
    expect(r.daysTrained).toEqual([true, false, true, false, false, false, false])
    expect(r.daysLeft).toBe(3) // Fri, Sat, Sun
    expect(r.progress).toBeCloseTo(2 / 3)
    expect(r.workouts.map((w) => w.date)).toEqual([D[0], D[2]])
  })

  it('marks a closed unmet week as missed and a met one as completed with extras', () => {
    const missed = computeMemberWeek({ user, weekId: WK, workouts: [wo('user1', D[1])], currentWeekId: '2026-W48' })
    expect(missed.status).toBe('missed')
    expect(missed.closed).toBe(true)
    expect(missed.daysLeft).toBe(0)
    const four = D.slice(0, 4).map((d) => wo('user1', d))
    const done = computeMemberWeek({ user, weekId: WK, workouts: four, closed: true })
    expect(done.status).toBe('completed')
    expect(done.extras).toBe(1)
    expect(done.remaining).toBe(0)
  })

  it('treats rest weeks as neutral, unless the goal was reached anyway', () => {
    const resting = { ...user, restWeeks: [WK] }
    const r = computeMemberWeek({ user: resting, weekId: WK, workouts: [], closed: true })
    expect(r.status).toBe('rest')
    expect(r.remaining).toBe(0)
    const busy = computeMemberWeek({ user: resting, weekId: WK, workouts: D.slice(0, 3).map((d) => wo('user1', d)), closed: true })
    expect(busy.status).toBe('completed')
  })

  it('falls back to the date when a workout has no weekId', () => {
    const r = computeMemberWeek({ user, weekId: WK, workouts: [{ userId: 'user1', date: D[6] }] })
    expect(r.sessions).toBe(1)
    expect(r.daysTrained[6]).toBe(true)
    expect(r.daysLeft).toBe(7) // no today given, open week
  })
})

describe('computeWeekClose', () => {
  const users = [
    { id: 'user1', weeklyGoal: 2 },
    { id: 'user2', restWeeks: [WK] },
    { id: 'user3', weeklyGoal: 3 },
    // user4 has no doc → defaults
  ]
  const workouts = [
    wo('user1', D[0], { duration: 45 }), wo('user1', D[3], { duration: 15 }),
    wo('user3', D[1]),
  ]
  const habits = [
    { id: 'h1', userId: 'user1', name: 'Leer', emoji: '📚', targetPerWeek: 2, visibility: 'family', order: 0 },
    { id: 'h2', userId: 'user1', name: 'Secreto', emoji: '🤫', targetPerWeek: 1, visibility: 'private', order: 1 },
    { id: 'h3', userId: 'user1', name: 'Agua', emoji: '💧', targetPerWeek: 7, order: 2 },
  ]
  const habitWeeks = [{ userId: 'user1', weekId: WK, checks: { h1: [D[0], D[1]], h2: [D[2]], h3: [D[0]] } }]
  const summaries = [
    { userId: 'user1', weekId: '2026-W45', status: 'completed' },
    { userId: 'user1', weekId: '2026-W46', status: 'rest' },
    { userId: 'user3', weekId: '2026-W46', status: 'missed' },
    { userId: 'user1', weekId: WK, status: 'missed' }, // stale doc for the same week must be ignored
  ]
  const input = { weekId: WK, userIds: USER_IDS, users, workouts, habits, habitWeeks, summaries }

  it('produces v2 summaries with the plan §4 shape', () => {
    const { summaries: out } = computeWeekClose(input)
    expect(out).toHaveLength(4)
    const s1 = out.find((s) => s.userId === 'user1')
    expect(s1).toEqual({
      userId: 'user1',
      weekId: WK,
      data: {
        userId: 'user1', weekId: WK, v: 2, status: 'completed',
        sessions: 2, goal: 2, totalRequired: 2, minutes: 60,
        habits: {
          total: 2, met: 1,
          items: [
            { habitId: 'h1', name: 'Leer', emoji: '📚', done: 2, target: 2 },
            { habitId: 'h3', name: 'Agua', emoji: '💧', done: 1, target: 7 },
          ],
        },
      },
    })
    expect(out.find((s) => s.userId === 'user2').data.status).toBe('rest')
    expect(out.find((s) => s.userId === 'user3').data.status).toBe('missed')
    const s4 = out.find((s) => s.userId === 'user4').data
    expect(s4).toMatchObject({ status: 'missed', sessions: 0, goal: 3, habits: { total: 0, met: 0, items: [] } })
  })

  it('builds the week post with streaks that include the closed week', () => {
    const { weekPost } = computeWeekClose(input)
    expect(weekPost.weekId).toBe(WK)
    expect(weekPost.data.v).toBe(2)
    expect(weekPost.data.results.map((r) => r.userId)).toEqual(USER_IDS)
    const r1 = weekPost.data.results[0]
    expect(r1).toEqual({ userId: 'user1', status: 'completed', sessions: 2, goal: 2, streak: 2, habitsMet: 1, habitsTotal: 2 })
    expect(weekPost.data.results[2].streak).toBe(0)
    expect(weekPost.data).not.toHaveProperty('createdAt')
    expect(weekPost.data).not.toHaveProperty('reactions')
  })

  it('is deterministic and idempotent', () => {
    const a = computeWeekClose(input)
    const b = computeWeekClose(input)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // Feeding its own output back as history doesn't change the result.
    const again = computeWeekClose({ ...input, summaries: [...summaries, ...a.summaries.map((s) => s.data)] })
    expect(JSON.stringify(again)).toBe(JSON.stringify(a))
  })

  it('does not mutate its inputs', () => {
    const copy = JSON.stringify(input)
    computeWeekClose(input)
    expect(JSON.stringify(input)).toBe(copy)
  })

  it('ignores habits created after the week and archived ones without checks', () => {
    const later = [
      { id: 'n1', userId: 'user3', name: 'Nuevo', targetPerWeek: 1, createdAt: new Date(2026, 11, 1).getTime() },
      { id: 'a1', userId: 'user3', name: 'Viejo', targetPerWeek: 1, archived: true },
      { id: 'a2', userId: 'user3', name: 'Archivado con check', targetPerWeek: 1, archived: true },
    ]
    const hw = [{ userId: 'user3', weekId: WK, checks: { a2: [D[0]] } }]
    const { summaries: out } = computeWeekClose({ ...input, habits: later, habitWeeks: hw })
    const s3 = out.find((s) => s.userId === 'user3').data
    expect(s3.habits.items.map((i) => i.habitId)).toEqual(['a2'])
    expect(s3.habits.met).toBe(1)
  })
})

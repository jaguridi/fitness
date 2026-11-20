// Offline tests: v2 week-close orchestration with an injected fake store.
// Run: cd functions && npm test
process.env.TZ = 'America/Santiago'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pendingWeeks, runWeeklyClose, planWeekResultPushes } from '../lib/weekClose.js'
import { V1_LOCK_PARKED } from '../game/constants.js'

/** In-memory store with the same semantics as lib/store.js. */
function fakeStore(initial = {}) {
  const state = {
    meta: { lastAutoProcessedWeekId: '2026-W46', ...(initial.meta || {}) },
    users: initial.users || [],
    workouts: initial.workouts || [],
    habits: initial.habits || [],
    habitWeeks: initial.habitWeeks || [],
    summaries: { ...(initial.summaries || {}) },
    weekPosts: { ...(initial.weekPosts || {}) },
    goals: (initial.goals || []).map((g) => ({ ...g })),
    calls: [],
    denyClaims: new Set(initial.denyClaims || []),
  }
  const last = () => state.meta.v2LastClosedWeekId || '2026-W46'
  return {
    state,
    async parkV1Lock() {
      if (state.meta.lastAutoProcessedWeekId === V1_LOCK_PARKED) return false
      state.meta = { ...state.meta, lastAutoProcessedWeekId: V1_LOCK_PARKED, v1LastProcessedWeekId: state.meta.lastAutoProcessedWeekId ?? null }
      return true
    },
    async getMeta() { return { ...state.meta } },
    async claimWeek(weekId) {
      state.calls.push(`claim ${weekId}`)
      if (last() >= weekId || state.denyClaims.has(weekId)) return false
      state.meta.v2Processing = { weekId }
      return true
    },
    async completeWeek(weekId) {
      state.calls.push(`complete ${weekId}`)
      state.meta.v2LastClosedWeekId = weekId
      delete state.meta.v2Processing
    },
    async loadInputs() {
      return {
        users: state.users, workouts: state.workouts, habits: state.habits, habitWeeks: state.habitWeeks,
        summaries: Object.values(state.summaries), goals: state.goals.map((g) => ({ ...g })),
      }
    },
    async writeSummary(userId, weekId, data) {
      state.calls.push(`summary ${userId}_${weekId}`)
      state.summaries[`${userId}_${weekId}`] = { ...(state.summaries[`${userId}_${weekId}`] || {}), ...data }
    },
    async writeWeekPost(weekId, data) {
      state.calls.push(`post ${weekId}`)
      const { reactions, comments, createdAt, ...rest } = data // eslint-disable-line no-unused-vars
      const prev = state.weekPosts[weekId]
      state.weekPosts[weekId] = { ...(prev || {}), ...rest, ...(prev ? {} : { createdAt: 'first' }) }
    },
    async markGoalMissed(goalId) {
      state.calls.push(`goal ${goalId}`)
      const g = state.goals.find((x) => x.id === goalId)
      if (!g || (g.status || 'active') !== 'active') return false
      g.status = 'missed'
      return true
    },
  }
}

const USERS = [
  { id: 'user1', name: 'Jose', weeklyGoal: 3 },
  { id: 'user2', name: 'Javi', weeklyGoal: 2, restWeeks: ['2026-W48'] },
  { id: 'user3', name: 'Gonza', weeklyGoal: 1 },
  { id: 'user4', name: 'Fran' },
]

const workout = (userId, date, weekId) => ({ userId, date, weekId, duration: 45, photoURL: 'x' })

test('pendingWeeks never goes before V2_START_WEEK and stops at the previous week', () => {
  assert.deepEqual(pendingWeeks(undefined, '2026-W47'), [])
  assert.deepEqual(pendingWeeks(undefined, '2026-W48'), ['2026-W47'])
  assert.deepEqual(pendingWeeks(undefined, '2026-W50'), ['2026-W47', '2026-W48', '2026-W49'])
  assert.deepEqual(pendingWeeks('2026-W48', '2026-W50'), ['2026-W49'])
  assert.deepEqual(pendingWeeks('2026-W49', '2026-W50'), [])
  // A stale v1-era value can't make v2 close v1 weeks.
  assert.deepEqual(pendingWeeks('2026-W40', '2026-W48'), ['2026-W47'])
  // Year boundary.
  // Year boundary (weekId.js quirk: 2026-W53 is followed by 2027-W02).
  assert.deepEqual(pendingWeeks('2026-W52', '2027-W02'), ['2026-W53'])
  assert.deepEqual(pendingWeeks('2026-W52', '2027-W03'), ['2026-W53', '2027-W02'])
})

test('closes pending weeks in order, parks the v1 lock, carries streak history over', async () => {
  const store = fakeStore({
    users: USERS,
    workouts: [
      // W47 (Nov 16–22): Jose 3/3, Gonza 1/1, Javi 0/2, Fran 1/3
      workout('user1', '2026-11-16', '2026-W47'), workout('user1', '2026-11-18', '2026-W47'), workout('user1', '2026-11-20', '2026-W47'),
      workout('user3', '2026-11-17', '2026-W47'),
      workout('user4', '2026-11-19', '2026-W47'),
      // W48 (Nov 23–29): Jose 3/3 again; Javi resting
      workout('user1', '2026-11-23', '2026-W48'), workout('user1', '2026-11-24', '2026-W48'), workout('user1', '2026-11-25', '2026-W48'),
    ],
    goals: [
      { id: 'g1', userId: 'user4', kind: 'auto', metric: 'sessions', target: 10, startDate: '2026-11-01', endDate: '2026-11-20', status: 'active' },
      { id: 'g2', userId: 'user1', kind: 'auto', metric: 'sessions', target: 10, startDate: '2026-11-01', endDate: '2026-12-31', status: 'active' },
      { id: 'g3', userId: 'user3', kind: 'manual', target: 1, startDate: '2026-11-01', endDate: '2026-11-18', status: 'cancelled' },
    ],
  })
  const out = await runWeeklyClose({ store, currentWeekId: '2026-W49' })
  assert.equal(out.parked, true)
  assert.equal(store.state.meta.lastAutoProcessedWeekId, V1_LOCK_PARKED)
  assert.equal(store.state.meta.v1LastProcessedWeekId, '2026-W46')
  assert.deepEqual(out.closed.map((c) => c.weekId), ['2026-W47', '2026-W48'])
  assert.equal(store.state.meta.v2LastClosedWeekId, '2026-W48')
  assert.equal(store.state.meta.v2Processing, undefined)

  const s = store.state.summaries
  assert.equal(s['user1_2026-W47'].status, 'completed')
  assert.equal(s['user2_2026-W47'].status, 'missed')
  assert.equal(s['user2_2026-W48'].status, 'rest')
  assert.equal(s['user3_2026-W47'].status, 'completed')
  assert.equal(s['user4_2026-W47'].goal, 3)
  assert.equal(s['user4_2026-W47'].v, 2)
  for (const doc of Object.values(s)) {
    for (const k of ['fineApplied', 'walletBalance', 'extraLives', 'hasShield']) assert.ok(!(k in doc), `no ${k}`)
  }

  const w48 = store.state.weekPosts['2026-W48'].results
  assert.equal(w48.find((r) => r.userId === 'user1').streak, 2, 'W47 summary carried into W48 streak')
  assert.equal(w48.find((r) => r.userId === 'user3').streak, 0, 'Gonza missed W48')

  assert.equal(store.state.goals.find((g) => g.id === 'g1').status, 'missed')
  assert.equal(store.state.goals.find((g) => g.id === 'g2').status, 'active')
  assert.equal(store.state.goals.find((g) => g.id === 'g3').status, 'cancelled')
  // g1 is marked once (W47), not again in W48.
  assert.equal(store.state.calls.filter((c) => c === 'goal g1').length, 1)

  // Order per week: claim → summaries → post → goals → complete.
  const w47 = store.state.calls.slice(0, store.state.calls.indexOf('complete 2026-W47') + 1)
  assert.equal(w47[0], 'claim 2026-W47')
  assert.ok(w47.indexOf('post 2026-W47') > w47.indexOf('summary user4_2026-W47'))
})

test('idempotent: a second run closes nothing and keeps the week post intact', async () => {
  const store = fakeStore({ users: USERS, workouts: [workout('user1', '2026-11-16', '2026-W47')] })
  await runWeeklyClose({ store, currentWeekId: '2026-W48' })
  store.state.weekPosts['2026-W47'].reactions = { user2: '🔥' }
  store.state.weekPosts['2026-W47'].comments = [{ userId: 'user3', text: 'bien', createdAt: 1 }]
  const before = JSON.stringify(store.state.weekPosts)
  const again = await runWeeklyClose({ store, currentWeekId: '2026-W48' })
  assert.equal(again.parked, false)
  assert.deepEqual(again.closed, [])
  assert.equal(JSON.stringify(store.state.weekPosts), before)
})

test('re-closing (forced) never drops reactions/comments nor moves createdAt', async () => {
  const store = fakeStore({ users: USERS })
  await store.writeWeekPost('2026-W47', { weekId: '2026-W47', v: 2, results: [] })
  store.state.weekPosts['2026-W47'].reactions = { user1: '🎉' }
  await store.writeWeekPost('2026-W47', { weekId: '2026-W47', v: 2, results: [{ userId: 'user1' }], reactions: {}, createdAt: 'later' })
  assert.deepEqual(store.state.weekPosts['2026-W47'].reactions, { user1: '🎉' })
  assert.equal(store.state.weekPosts['2026-W47'].createdAt, 'first')
})

test('stops at a week claimed elsewhere and does not close later weeks', async () => {
  const store = fakeStore({ users: USERS, denyClaims: ['2026-W48'] })
  const out = await runWeeklyClose({ store, currentWeekId: '2026-W50' })
  assert.deepEqual(out.closed.map((c) => c.weekId), ['2026-W47'])
  assert.equal(out.stoppedAt, '2026-W48')
  assert.equal(store.state.meta.v2LastClosedWeekId, '2026-W47')
  assert.ok(!store.state.calls.includes('claim 2026-W49'))
})

test('no pending weeks: nothing is loaded or written', async () => {
  const store = fakeStore({ meta: { lastAutoProcessedWeekId: V1_LOCK_PARKED, v2LastClosedWeekId: '2026-W47' } })
  store.loadInputs = () => { throw new Error('should not load') }
  const out = await runWeeklyClose({ store, currentWeekId: '2026-W48' })
  assert.deepEqual(out, { parked: false, closed: [], stoppedAt: null })
})

test('result pushes: one per member, kind copy for each status', () => {
  const plan = planWeekResultPushes({
    results: [
      { userId: 'user1', status: 'completed', sessions: 4, goal: 3, streak: 5 },
      { userId: 'user2', status: 'missed', sessions: 1, goal: 2, streak: 0 },
      { userId: 'user3', status: 'rest', sessions: 0, goal: 1, streak: 2 },
      { userId: 'nobody', status: 'completed', sessions: 1, goal: 1, streak: 1 },
    ],
  }, USERS)
  assert.equal(plan.length, 3)
  assert.match(plan[0].copy.body, /Racha de 5 semanas/)
  assert.match(plan[1].copy.title, /nueva oportunidad/)
  assert.match(plan[1].copy.body, /campeona/)
  assert.doesNotMatch(plan[1].copy.body, /multa|deuda|culpa/i)
  assert.match(plan[2].copy.body, /racha de 2 semanas sigue intacta/)
})

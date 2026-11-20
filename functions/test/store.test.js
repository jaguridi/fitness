// Offline tests: lib/store.js (the production week-close store) against a
// tiny in-memory Firestore fake — claim protocol, v1 park, week post merge,
// goal transitions and the results-push marker.
// Run: cd functions && npm test
process.env.TZ = 'America/Santiago'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFirestoreStore } from '../lib/store.js'
import { runWeeklyClose } from '../lib/weekClose.js'

const DELETE = Symbol('delete')
const SERVER_TS = Symbol('ts')
const FieldValue = { delete: () => DELETE, serverTimestamp: () => SERVER_TS }

function fakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial))
  const now = () => ({ toMillis: () => Date.now() })
  const resolve = (v) => (v === SERVER_TS ? now() : v)
  const apply = (path, data, merge) => {
    const base = merge ? { ...(docs.get(path) || {}) } : {}
    for (const [k, v] of Object.entries(data)) {
      if (v === DELETE) delete base[k]
      else base[k] = v && typeof v === 'object' && !Array.isArray(v) && !v.toMillis
        ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, resolve(b)]))
        : resolve(v)
    }
    docs.set(path, base)
  }
  const docRef = (path) => ({
    path,
    async get() { return snap(path) },
    async set(data, opts) { apply(path, data, opts?.merge) },
    async update(data) {
      if (!docs.has(path)) throw new Error(`no doc ${path}`)
      apply(path, data, true)
    },
  })
  const snap = (path) => ({ exists: docs.has(path), id: path.split('/')[1], data: () => docs.get(path) })
  return {
    docs,
    collection: (name) => ({
      doc: (id) => docRef(`${name}/${id}`),
      async get() {
        return { docs: [...docs.keys()].filter((k) => k.startsWith(`${name}/`)).map(snap) }
      },
    }),
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data, opts) => apply(ref.path, data, opts?.merge),
        update: (ref, data) => apply(ref.path, data, true),
      })
    },
  }
}

test('parkV1Lock: parks once, keeps the old value', async () => {
  const db = fakeDb({ 'settings/meta': { lastAutoProcessedWeekId: '2026-W46' } })
  const store = createFirestoreStore(db, FieldValue)
  assert.equal(await store.parkV1Lock(), true)
  assert.equal(await store.parkV1Lock(), false)
  const meta = db.docs.get('settings/meta')
  assert.equal(meta.lastAutoProcessedWeekId, '9999-W99')
  assert.equal(meta.v1LastProcessedWeekId, '2026-W46')
})

test('claimWeek: refuses closed weeks and fresh claims, never weeks before V2_START_WEEK', async () => {
  const db = fakeDb({ 'settings/meta': {} })
  const store = createFirestoreStore(db, FieldValue)
  assert.equal(await store.claimWeek('2026-W46'), false, 'missing lock = week before V2_START_WEEK')
  assert.equal(await store.claimWeek('2026-W47'), true)
  assert.equal(await store.claimWeek('2026-W47'), false, 'fresh claim elsewhere')
  await store.completeWeek('2026-W47')
  assert.equal(db.docs.get('settings/meta').v2LastClosedWeekId, '2026-W47')
  assert.ok(!('v2Processing' in db.docs.get('settings/meta')))
  assert.equal(await store.claimWeek('2026-W47'), false, 'already closed')
  // Stale claim (older than the TTL) can be taken over.
  db.docs.get('settings/meta').v2Processing = { weekId: '2026-W48', startedAt: { toMillis: () => Date.now() - 10 * 60 * 1000 } }
  assert.equal(await store.claimWeek('2026-W48'), true)
})

test('writeWeekPost keeps reactions/comments/createdAt; markGoalMissed only from active', async () => {
  const db = fakeDb({
    'goals/a': { status: 'active' }, 'goals/b': { status: 'achieved' }, 'goals/c': {},
  })
  const store = createFirestoreStore(db, FieldValue)
  await store.writeWeekPost('2026-W47', { weekId: '2026-W47', v: 2, results: [1] })
  const createdAt = db.docs.get('week_posts/2026-W47').createdAt
  assert.ok(createdAt)
  db.docs.get('week_posts/2026-W47').reactions = { user1: '🔥' }
  await store.writeWeekPost('2026-W47', { weekId: '2026-W47', v: 2, results: [2], reactions: {}, comments: [], createdAt: 'x' })
  const post = db.docs.get('week_posts/2026-W47')
  assert.deepEqual(post.results, [2])
  assert.deepEqual(post.reactions, { user1: '🔥' })
  assert.equal(post.createdAt, createdAt)
  assert.equal(await store.markGoalMissed('a'), true)
  assert.equal(await store.markGoalMissed('b'), false)
  assert.equal(await store.markGoalMissed('c'), true, 'missing status counts as active')
  assert.equal(await store.markGoalMissed('zzz'), false)
  assert.equal(db.docs.get('goals/b').status, 'achieved')
})

test('claimResultsPush: exactly once per existing week post', async () => {
  const db = fakeDb({ 'week_posts/2026-W47': { weekId: '2026-W47' } })
  const store = createFirestoreStore(db, FieldValue)
  assert.equal(await store.claimResultsPush('2026-W48'), false, 'no post yet')
  assert.equal(await store.claimResultsPush('2026-W47'), true)
  assert.equal(await store.claimResultsPush('2026-W47'), false)
})

test('end to end on the fake db: close W47 twice → one set of writes', async () => {
  const db = fakeDb({
    'settings/meta': { lastAutoProcessedWeekId: '2026-W46' },
    'users/user1': { name: 'Jose', weeklyGoal: 1 },
    'workouts/w1': { userId: 'user1', date: '2026-11-18', weekId: '2026-W47', duration: 30, photoURL: 'p' },
  })
  const store = createFirestoreStore(db, FieldValue)
  const first = await runWeeklyClose({ store, currentWeekId: '2026-W48' })
  assert.deepEqual(first.closed.map((c) => c.weekId), ['2026-W47'])
  const s = db.docs.get('weekly_summaries/user1_2026-W47')
  assert.equal(s.status, 'completed')
  assert.equal(db.docs.get('weekly_summaries/user2_2026-W47').status, 'missed')
  assert.equal(db.docs.get('week_posts/2026-W47').results.length, 4)
  const second = await runWeeklyClose({ store, currentWeekId: '2026-W48' })
  assert.deepEqual(second.closed, [])
})

// Offline tests: AI recap input builders, prompts and the (faked) model call.
// Run: cd functions && npm test
process.env.TZ = 'America/Santiago'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeeklyRecapInput, weeklyRecapText, buildMonthlyRecapInput, monthlyRecapText,
  completeRecap, weekInMonth, WEEKLY_SYSTEM_PROMPT, MONTHLY_SYSTEM_PROMPT, RECAP_MODEL,
} from '../lib/recaps.js'
import { getOrCreateWeeklyRecap } from '../lib/recapJobs.js'

const USERS = [
  { id: 'user1', name: 'Jose' }, { id: 'user2', name: 'Javi' }, { id: 'user3', name: 'Gonza' }, { id: 'user4', name: 'Fran' },
]
const at = (y, m, d, h = 12) => ({ toMillis: () => new Date(y, m - 1, d, h).getTime() })
const SUMMARIES = [
  // v1 history (fines fields must never leak into the prompt)
  { userId: 'user1', weekId: '2026-W46', status: 'completed', sessions: 3, totalRequired: 3, fineApplied: 0 },
  { userId: 'user2', weekId: '2026-W46', status: 'missed', sessions: 0, totalRequired: 3, fineApplied: 40000 },
  // v2 week
  { userId: 'user1', weekId: '2026-W47', v: 2, status: 'completed', sessions: 4, goal: 3, minutes: 180,
    habits: { total: 1, met: 1, items: [{ habitId: 'h1', name: 'Leer', emoji: '📖', done: 7, target: 7 }] } },
  { userId: 'user2', weekId: '2026-W47', v: 2, status: 'missed', sessions: 1, goal: 2, minutes: 30, habits: { total: 0, met: 0, items: [] } },
  { userId: 'user3', weekId: '2026-W47', v: 2, status: 'rest', sessions: 0, goal: 3, minutes: 0, habits: { total: 0, met: 0, items: [] } },
]
const UNLOCKS = [
  { userId: 'user1', name: 'Racha de 2', icon: '🔥', createdAt: at(2026, 11, 20) },
  { userId: 'user1', name: 'Vieja', icon: '⭐', seeded: true, createdAt: at(2026, 11, 20) },
  { userId: 'user2', name: 'Otra semana', icon: '✨', createdAt: at(2026, 11, 24) },
]
const GOALS = [
  { userId: 'user2', title: 'Correr 50 km', emoji: '🏃', createdAt: at(2026, 11, 18), status: 'active' },
  { userId: 'user2', title: 'Secreta', createdAt: at(2026, 11, 18), status: 'achieved', achievedAt: at(2026, 11, 19), visibility: 'private' },
  { userId: 'user1', title: 'Yoga 8 veces', emoji: '🧘', createdAt: at(2026, 11, 1), status: 'achieved', achievedAt: at(2026, 11, 21), reward: 'Zapatillas' },
]

test('weekly input: own goals, streaks, habits, stickers, family goals only', () => {
  const people = buildWeeklyRecapInput({ weekId: '2026-W47', users: USERS, summaries: SUMMARIES, unlocks: UNLOCKS, goals: GOALS })
  assert.deepEqual(people.map((p) => p.name), ['Jose', 'Javi', 'Gonza'])
  const [jose, javi, gonza] = people
  assert.equal(jose.goal, 3)
  assert.equal(jose.streak, 2, 'v1 completed W46 + v2 completed W47')
  assert.equal(javi.streak, 0)
  assert.equal(gonza.status, 'rest')
  assert.deepEqual(jose.stickers, ['🔥 Racha de 2'], 'seeded and other-week stickers excluded')
  assert.deepEqual(jose.goalsAchieved, [{ title: '🧘 Yoga 8 veces', reward: 'Zapatillas' }])
  assert.deepEqual(javi.goalsCreated, ['🏃 Correr 50 km'], 'private goal excluded')
  assert.deepEqual(javi.goalsAchieved, [])

  const text = weeklyRecapText('2026-W47', people)
  assert.match(text, /Jose: 4\/3 sesiones \(su meta\), estado=completed, racha=2 semanas/)
  assert.match(text, /📖 Leer 7\/7/)
  assert.match(text, /se ganó: Zapatillas/)
  assert.doesNotMatch(text, /multa|40000|Secreta|Vieja/)
})

test('monthly input: v1 + v2 weeks, no money, family habits only', () => {
  assert.equal(weekInMonth('2026-W47', '2026-11'), true)
  assert.equal(weekInMonth('2026-W49', '2026-11'), true) // Monday Nov 30
  assert.equal(weekInMonth('2026-W50', '2026-11'), false)
  const workouts = [
    { userId: 'user1', date: '2026-11-17', duration: 60, calories: 300, exerciseType: ['Yoga'] },
    { userId: 'user1', date: '2026-11-18', duration: 30, exerciseType: 'Yoga' },
    { userId: 'user2', date: '2026-10-31', duration: 30 },
  ]
  const habits = [{ id: 'h1', userId: 'user1' }, { id: 'hp', userId: 'user1', visibility: 'private' }]
  const habitWeeks = [{ userId: 'user1', weekId: '2026-W47', checks: { h1: ['2026-11-16', '2026-11-17'], hp: ['2026-11-16'] } }]
  const input = buildMonthlyRecapInput({ monthId: '2026-11', users: USERS, summaries: SUMMARIES, workouts, habitWeeks, habits, unlocks: UNLOCKS, goals: GOALS })
  const jose = input.perUser.find((u) => u.userId === 'user1')
  assert.equal(jose.sessions, 2)
  assert.equal(jose.minutes, 90)
  assert.equal(jose.weeksCompleted, 2)
  assert.equal(jose.habitChecks, 2)
  assert.deepEqual(jose.topTypes, ['Yoga'])
  assert.equal(input.totals.sessions, 2)
  const javi = input.perUser.find((u) => u.userId === 'user2')
  assert.equal(javi.weeksMissed, 2)
  assert.ok(!input.perUser.some((u) => u.userId === 'user4'), 'no data → not in the recap')
  const text = monthlyRecapText(input)
  assert.match(text, /noviembre 2026/)
  assert.doesNotMatch(text, /multa|40000|\$/)
  for (const k of ['finesPaid', 'weeksJustified', 'weeksFrozen']) assert.ok(!(k in jose))
})

test('prompts: tú, no voseo, no fines, gender rule', () => {
  for (const p of [WEEKLY_SYSTEM_PROMPT, MONTHLY_SYSTEM_PROMPT]) {
    assert.match(p, /de tú/)
    assert.match(p, /NUNCA uses voseo/)
    assert.match(p, /NO tiene multas/)
    assert.match(p, /género gramatical/)
  }
})

test('completeRecap: same model/effort, gender guide appended, tags stripped', async () => {
  let req
  const client = { chat: { completions: { create: async (r) => { req = r; return { choices: [{ message: { content: 'Javi (mujer) la rompió.' } }] } } } } }
  const out = await completeRecap(client, { system: 'S', user: 'U', people: [{ name: 'Javi', gender: 'f' }], names: ['Javi'] })
  assert.equal(out, 'Javi la rompió.')
  assert.equal(req.model, RECAP_MODEL)
  assert.equal(req.model, 'gpt-5.6-luna')
  assert.equal(req.reasoning_effort, 'high')
  assert.match(req.messages[1].content, /Javi: femenino/)
})

test('getOrCreateWeeklyRecap: caches and mirrors into week_posts; not-found without summaries', async () => {
  const docs = {
    'weekly_summaries/a': SUMMARIES[2], 'users/user1': USERS[0],
    'week_posts/2026-W47': { weekId: '2026-W47', results: [] },
  }
  const db = {
    collection: (name) => ({
      get: async () => ({ docs: Object.entries(docs).filter(([k]) => k.startsWith(`${name}/`)).map(([k, v]) => ({ id: k.split('/')[1], data: () => v })) }),
      doc: (id) => ({
        get: async () => ({ exists: `${name}/${id}` in docs, data: () => docs[`${name}/${id}`] }),
        set: async (v) => { docs[`${name}/${id}`] = v },
        update: async (v) => { docs[`${name}/${id}`] = { ...docs[`${name}/${id}`], ...v } },
      }),
    }),
  }
  let calls = 0
  const makeClient = () => ({ chat: { completions: { create: async () => { calls++; return { choices: [{ message: { content: 'Gran semana 💪' } }] } } } } })
  const r1 = await getOrCreateWeeklyRecap({ db, makeClient, weekId: '2026-W47' })
  assert.equal(r1.recap, 'Gran semana 💪')
  assert.equal(docs['week_posts/2026-W47'].recap, 'Gran semana 💪')
  await getOrCreateWeeklyRecap({ db, makeClient, weekId: '2026-W47' })
  assert.equal(calls, 1, 'second call served from weekly_recaps')
  await assert.rejects(getOrCreateWeeklyRecap({ db, makeClient, weekId: '2026-W40' }), { code: 'not-found' })
})

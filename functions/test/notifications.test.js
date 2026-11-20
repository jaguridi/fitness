// Offline tests: push copy, reminder decisions, social planners, push plumbing.
// Run: cd functions && npm test
process.env.TZ = 'America/Santiago'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as copy from '../lib/copy.js'
import { planKickoff, planMidweek, planLastCall, planHabitReminders, pendingHabitsToday } from '../lib/reminders.js'
import {
  newComments, newReactions, planWorkoutCreated, planOwnerEngagement, planWeekPostComments,
  planUnlockCreated, planGoalCreated, planGoalAchieved,
} from '../lib/social.js'
import { buildMessage, tokensFor, createPusher } from '../lib/push.js'

const USERS = [
  { id: 'user1', name: 'Jose', weeklyGoal: 3, fcmTokens: ['t1'] },
  { id: 'user2', name: 'Javi', weeklyGoal: 2 },
  { id: 'user3', name: 'Gonza', weeklyGoal: 4, restWeeks: ['2026-W48'] },
  { id: 'user4', name: 'Fran', weeklyGoal: 3, prefs: { habitReminder: false } },
]
const WEEK = '2026-W48' // Mon 2026-11-23 … Sun 2026-11-29
const w = (userId, date) => ({ userId, date, weekId: WEEK, duration: 30, exerciseType: ['Yoga'] })
const created = { toMillis: () => new Date(2026, 10, 1).getTime() }

const VOSEO = /\b(vos|podés|tenés|elegí|querés|sabés|hacé|andá|tenís|rebobiná)\b/i
const FINES = /multa|pozo|vida extra|escudo|canje|deuda|\$\s?\d/i

function assertCleanCopy(c) {
  if (!c) return
  for (const field of [c.title, c.body]) {
    assert.doesNotMatch(field, VOSEO, `voseo in: ${field}`)
    assert.doesNotMatch(field, FINES, `fines in: ${field}`)
  }
  assert.ok(c.link.startsWith('https://fitness.jaguridi.cl/'), 'links to the live app')
}

test('every copy builder: tú form, no fines, live-app links', () => {
  const u = USERS[1]
  const all = [
    copy.kickoffCopy(u, { goal: 1, habitsCount: 1 }),
    copy.kickoffCopy(u, { goal: 3, habitsCount: 0 }),
    copy.midweekCopy(u, { sessions: 0, goal: 3, remaining: 3, daysLeft: 4 }),
    copy.lastCallCopy(u, { remaining: 1 }),
    copy.habitReminderCopy(u, [{ name: 'Leer', emoji: '📖' }]),
    copy.habitReminderCopy(u, [{ name: 'Leer' }, { name: 'Agua' }, { name: 'Meditar' }]),
    copy.habitReminderCopy(u, [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }]),
    copy.weekResultCopy(u, { status: 'completed', sessions: 2, goal: 2, streak: 1 }),
    copy.weekResultCopy(u, { status: 'missed', sessions: 0, goal: 2, streak: 0 }),
    copy.weekResultCopy(u, { status: 'rest', sessions: 0, goal: 2, streak: 0 }),
    copy.workoutCreatedCopy(u, { exerciseType: ['Yoga', 'Correr'], duration: 40 }),
    copy.commentCopy('workout', u, { text: 'Bien!' }),
    copy.reactionCopy('goal', u, '🔥', { title: 'Correr 100 km', emoji: '🏃' }),
    copy.weekPostCommentCopy(u, { text: 'Vamos' }, WEEK),
    copy.unlockCopy(u, { name: 'Racha de 4', icon: '🔥', rarity: 'epica', number: 3, description: '4 semanas seguidas' }),
    copy.goalCreatedCopy(u, { title: 'Leer 4 libros', emoji: '📖', reward: 'Un libro nuevo' }),
    copy.goalAchievedCopy(u, { title: 'Leer 4 libros' }),
    copy.goalAchievedCopy(u, { title: 'Leer 4 libros', reward: 'Zapatillas' }),
    ...copy.NUDGE_MESSAGES.map((_, i) => copy.nudgeCopy('Jose', () => i / copy.NUDGE_MESSAGES.length)),
  ]
  all.forEach(assertCleanCopy)
  assert.equal(all[0].body, 'Hola Javi, tu meta es de 1 sesión esta semana. Y 1 hábito para ir marcando. ¡Vamos!')
  assert.match(all[3].body, /te falta 1 sesión/)
  assert.match(all[14].title, /^🏅 Javi ganó la lámina 🔥 Racha de 4$/)
  assert.match(all[14].body, /lámina épica/)
  assert.match(all[17].body, /se ganó: Zapatillas/)
  assert.match(all[16].body, /Felicítala/)
})

test('kickoff: own goal + habit count, skips rest weeks', () => {
  const habits = [
    { id: 'h1', userId: 'user1', name: 'Leer', targetPerWeek: 7, createdAt: created },
    { id: 'h2', userId: 'user1', name: 'Agua', targetPerWeek: 3, createdAt: created },
    { id: 'h3', userId: 'user1', name: 'Viejo', targetPerWeek: 3, archived: true, createdAt: created },
  ]
  const plan = planKickoff({ users: USERS, habits, workouts: [], weekId: WEEK, today: '2026-11-23' })
  assert.deepEqual(plan.map((p) => p.user.id), ['user1', 'user2', 'user4'])
  assert.match(plan[0].copy.body, /3 sesiones.*2 hábitos/)
  assert.doesNotMatch(plan[1].copy.body, /hábito/)
})

test('midweek: only clearly behind (2+ missing), never resting or met', () => {
  const workouts = [w('user1', '2026-11-23'), w('user2', '2026-11-23'), w('user2', '2026-11-24')]
  const plan = planMidweek({ users: USERS, workouts, weekId: WEEK, today: '2026-11-26' })
  // Jose 1/3 → 2 missing → yes; Javi 2/2 met → no; Gonza resting → no; Fran 0/3 → yes
  assert.deepEqual(plan.map((p) => p.user.id), ['user1', 'user4'])
  assert.match(plan[0].copy.body, /llevas 1 de 3.*faltan 2 sesiones.*quedan 4 días/)
})

test('last call: only while the goal is open', () => {
  const workouts = [w('user1', '2026-11-23'), w('user1', '2026-11-24'), w('user1', '2026-11-25'), w('user2', '2026-11-28')]
  const plan = planLastCall({ users: USERS, workouts, weekId: WEEK, today: '2026-11-29' })
  assert.deepEqual(plan.map((p) => p.user.id), ['user2', 'user4'])
  assert.match(plan[0].copy.body, /te falta 1 sesión/)
})

test('habit reminder: unchecked today and still relevant; respects prefs and rest weeks', () => {
  const habits = [
    { id: 'daily', userId: 'user1', name: 'Leer', emoji: '📖', targetPerWeek: 7, createdAt: created, order: 1 },
    { id: 'met', userId: 'user1', name: 'Correr', targetPerWeek: 2, createdAt: created },
    { id: 'today', userId: 'user1', name: 'Agua', targetPerWeek: 7, createdAt: created },
    { id: 'arch', userId: 'user1', name: 'Viejo', targetPerWeek: 7, archived: true, createdAt: created },
    { id: 'priv', userId: 'user2', name: 'Diario', targetPerWeek: 5, visibility: 'private', createdAt: created },
    { id: 'gz', userId: 'user3', name: 'Estirar', targetPerWeek: 7, createdAt: created },
    { id: 'fr', userId: 'user4', name: 'Meditar', targetPerWeek: 7, createdAt: created },
    { id: 'future', userId: 'user2', name: 'Nuevo', targetPerWeek: 7, createdAt: { toMillis: () => new Date(2026, 11, 10).getTime() } },
  ]
  const habitWeeks = [
    { userId: 'user1', weekId: WEEK, checks: { met: ['2026-11-23', '2026-11-24'], today: ['2026-11-25'], daily: ['2026-11-23'] } },
  ]
  const today = '2026-11-25'
  assert.deepEqual(pendingHabitsToday({ habits, habitWeeks, userId: 'user1', weekId: WEEK, today }).map((h) => h.id), ['daily'])
  const plan = planHabitReminders({ users: USERS, habits, habitWeeks, weekId: WEEK, today })
  // Jose: 'daily' only; Javi: private habit (her own push); Gonza resting; Fran opted out.
  assert.deepEqual(plan.map((p) => p.user.id), ['user1', 'user2'])
  assert.match(plan[0].copy.body, /"📖 Leer"/)
  assert.match(plan[1].copy.body, /Diario/)
  // Nothing pending → no push.
  const none = planHabitReminders({ users: [USERS[0]], habits: habits.filter((h) => h.id === 'met'), habitWeeks, weekId: WEEK, today })
  assert.deepEqual(none, [])
})

test('comment/reaction diffs', () => {
  const before = { comments: [{ userId: 'user2', text: 'a', createdAt: 1 }], reactions: { user2: '🔥' } }
  const after = {
    comments: [...before.comments, { userId: 'user3', text: 'b', createdAt: 2 }],
    reactions: { user2: '🔥', user3: '💪', user4: '' },
  }
  assert.deepEqual(newComments(before, after).map((c) => c.text), ['b'])
  assert.deepEqual(newReactions(before, after), [{ userId: 'user3', emoji: '💪' }])
  assert.deepEqual(newReactions({ reactions: { user2: '🔥' } }, { reactions: { user2: '😂' } }), [{ userId: 'user2', emoji: '😂' }])
})

test('workout created → rest of the family; engagement → owner, never self', () => {
  assert.deepEqual(planWorkoutCreated({ userId: 'user1', exerciseType: 'Yoga', duration: 30 }, USERS).map((p) => p.user.id), ['user2', 'user3', 'user4'])
  const before = { userId: 'user1', comments: [], reactions: {} }
  const after = { userId: 'user1', comments: [{ userId: 'user1', text: 'yo', createdAt: 1 }, { userId: 'user2', text: 'grande', createdAt: 2 }], reactions: { user1: '🔥', user3: '👏' } }
  const plan = planOwnerEngagement('workout', before, after, USERS)
  assert.deepEqual(plan.map((p) => p.user.id), ['user1', 'user1'])
  assert.match(plan[0].copy.title, /Javi comentó tu ejercicio/)
  assert.match(plan[1].copy.title, /👏 Gonza reaccionó/)
})

test('private goals never push; goal created/achieved → family', () => {
  const goal = { userId: 'user2', title: 'Leer 4 libros', emoji: '📖', status: 'active', reward: 'Un libro' }
  assert.equal(planGoalCreated(goal, USERS).length, 3)
  assert.equal(planGoalCreated({ ...goal, visibility: 'private' }, USERS).length, 0)
  const achieved = { ...goal, status: 'achieved' }
  assert.equal(planGoalAchieved(goal, achieved, USERS).length, 3)
  assert.match(planGoalAchieved(goal, achieved, USERS)[0].copy.body, /se ganó: Un libro/)
  assert.equal(planGoalAchieved(achieved, achieved, USERS).length, 0, 'only on the transition')
  assert.equal(planGoalAchieved(goal, { ...achieved, visibility: 'private' }, USERS).length, 0)
  const privAfter = { ...goal, visibility: 'private', comments: [{ userId: 'user1', text: 'x', createdAt: 1 }] }
  assert.equal(planOwnerEngagement('goal', { ...goal, visibility: 'private' }, privAfter, USERS).length, 0)
})

test('unlocks: seeded never push; new ones → rest of the family', () => {
  const unlock = { userId: 'user1', achievementId: 'streak_4', name: 'Racha de 4', icon: '🔥', rarity: 'rara' }
  assert.deepEqual(planUnlockCreated(unlock, USERS).map((p) => p.user.id), ['user2', 'user3', 'user4'])
  assert.deepEqual(planUnlockCreated({ ...unlock, seeded: true }, USERS), [])
})

test('week post comments → thread participants, or everyone else when alone', () => {
  const first = planWeekPostComments({ comments: [], reactions: {} }, { comments: [{ userId: 'user1', text: 'Bien familia', createdAt: 1 }], reactions: {} }, USERS, WEEK)
  assert.deepEqual(first.map((p) => p.user.id), ['user2', 'user3', 'user4'])
  const before = { comments: [{ userId: 'user1', text: 'a', createdAt: 1 }], reactions: { user4: '🎉' } }
  const after = { ...before, comments: [...before.comments, { userId: 'user2', text: 'b', createdAt: 2 }] }
  assert.deepEqual(planWeekPostComments(before, after, USERS, WEEK).map((p) => p.user.id).sort(), ['user1', 'user4'])
  // Reactions alone never push.
  assert.deepEqual(planWeekPostComments(before, { ...before, reactions: { user4: '🎉', user3: '🔥' } }, USERS, WEEK), [])
})

test('push plumbing: message shape, token dedupe, dead-token pruning', async () => {
  assert.deepEqual(tokensFor({ fcmTokens: ['a', 'b', 'a'], fcmToken: 'b' }), ['a', 'b'])
  assert.deepEqual(tokensFor({}), [])
  const msg = buildMessage('tok', { title: 'T', body: 'B', tag: 'x', link: copy.LINKS.family })
  assert.equal(msg.webpush.notification.icon, 'https://fitness.jaguridi.cl/avatars/jose.png')
  assert.equal(msg.webpush.fcmOptions.link, 'https://fitness.jaguridi.cl/#/familia')
  assert.equal(msg.data.url, 'https://fitness.jaguridi.cl/#/familia')

  const sent = []
  const updates = []
  const messaging = {
    async send(m) {
      if (m.token === 'dead') throw Object.assign(new Error('gone'), { code: 'messaging/registration-token-not-registered' })
      sent.push(m.token)
    },
  }
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ fcmToken: 'dead' }) }),
        update: async (u) => updates.push(u),
      }),
    }),
  }
  const FieldValue = { arrayRemove: (t) => ({ remove: t }), delete: () => 'DELETE' }
  const pusher = createPusher({ messaging, db, FieldValue, log: { log() {}, warn() {} } })
  const n = await pusher.sendAll([{ user: { id: 'user1', fcmTokens: ['ok', 'dead'] }, copy: copy.lastCallCopy(USERS[0], { remaining: 2 }) }])
  assert.equal(n, 1)
  assert.deepEqual(sent, ['ok'])
  assert.deepEqual(updates, [{ fcmTokens: { remove: 'dead' }, fcmToken: 'DELETE' }])
})

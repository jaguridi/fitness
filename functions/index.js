/**
 * FitFamily v2 — Firebase Cloud Functions (no fines: plan docs/V2_PLAN.md).
 *
 * Scheduled (America/Santiago):
 *   - Monday   00:10 → weeklyClose: park the v1 fines lock, close pending weeks
 *                       (weekly_summaries + week_posts + expired goals), AI recap,
 *                       personal result pushes
 *   - Monday   09:00 → mondayKickoff: own weekly goal + habits tracked
 *   - Thursday 09:00 → midweekReminder: only when clearly behind
 *   - Sunday   17:00 → lastCallReminder: only while the goal is still open
 *   - Daily    20:30 → habitReminder: unchecked habits that still matter this week
 *
 * Firestore triggers (social pushes):
 *   - workouts created / updated           → family / owner (comments, reactions)
 *   - achievement_unlocks created / updated → family (new sticker, not seeded) / owner
 *   - goals created / updated               → family (created, achieved; family-visible only) / owner
 *   - week_posts updated                    → thread participants (new comments)
 *
 * Callables: sendNudge, generateWeeklyRecap, generateMonthlyRecap.
 *
 * Pure logic lives in ./lib (tested offline: `npm test` here) and ./game —
 * AUTO-GENERATED copies of src/game/ kept in sync by scripts/sync-game.mjs
 * (wired as a predeploy hook in firebase.json).
 */

// All date math (week ids, day-of-week) must match the family's clocks.
process.env.TZ = 'America/Santiago'

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import OpenAI from 'openai'

import { getWeekId, getPreviousWeekId } from './game/weekId.js'
import { V2_START_WEEK } from './game/constants.js'
import { todayYMD } from './game/habits.js'
import { createFirestoreStore, getCollection } from './lib/store.js'
import { createPusher, tokensFor } from './lib/push.js'
import { runWeeklyClose, planWeekResultPushes } from './lib/weekClose.js'
import { planKickoff, planMidweek, planLastCall, planHabitReminders } from './lib/reminders.js'
import {
  planWorkoutCreated, planOwnerEngagement, planWeekPostComments,
  planUnlockCreated, planGoalCreated, planGoalAchieved,
} from './lib/social.js'
import { nudgeCopy } from './lib/copy.js'
import { getOrCreateWeeklyRecap, getOrCreateMonthlyRecap } from './lib/recapJobs.js'

// Note: the secret in Secret Manager is named OPEN_AI_KEY (not the
// conventional OPENAI_API_KEY) — it was created by hand in the console.
const openaiApiKey = defineSecret('OPEN_AI_KEY')
const makeOpenAI = () => new OpenAI({ apiKey: openaiApiKey.value() })

initializeApp()
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
const TIMEZONE = 'America/Santiago'

const store = createFirestoreStore(db, FieldValue)
const pusher = createPusher({ messaging: { send: (msg) => getMessaging().send(msg) }, db, FieldValue })
const getAllUsers = () => getCollection(db, 'users')

/** users + this week's workouts (by stored weekId). */
async function loadWeekState(weekId) {
  const [users, workoutsSnap] = await Promise.all([
    getAllUsers(),
    db.collection('workouts').where('weekId', '==', weekId).get(),
  ])
  return { users, workouts: workoutsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) }
}

// ── 1. Weekly close (Monday 00:10) ────────────────────────────
// Same claim protocol as the client fallback (src/data/weekClose.js), so
// whoever runs first wins and the other side skips.

export const weeklyClose = onSchedule(
  { schedule: 'every monday 00:10', timeZone: TIMEZONE, maxInstances: 1, secrets: [openaiApiKey], timeoutSeconds: 540 },
  async () => {
    const currentWeekId = getWeekId()
    const prevWeekId = getPreviousWeekId(currentWeekId)
    const { closed } = await runWeeklyClose({ store, currentWeekId, log: console.log })

    // Recap + result pushes only for the week that just ended, once it is
    // closed (by this run or by a client that got there first).
    const meta = await store.getMeta()
    if (prevWeekId < V2_START_WEEK || !meta.v2LastClosedWeekId || meta.v2LastClosedWeekId < prevWeekId) {
      console.log(`weeklyClose: ${prevWeekId} not closed (v2 lock at ${meta.v2LastClosedWeekId ?? 'none'}); no recap or pushes`)
      return
    }

    try {
      await getOrCreateWeeklyRecap({ db, makeClient: makeOpenAI, weekId: prevWeekId })
    } catch (err) {
      // A recap failure must never fail the close.
      console.error(`weeklyClose: recap for ${prevWeekId} failed:`, err)
    }

    // The marker on week_posts makes the pushes go out exactly once per week,
    // even if this function runs twice or a client closed the week.
    if (!(await store.claimResultsPush(prevWeekId))) {
      console.log(`weeklyClose: results for ${prevWeekId} already sent`)
      return
    }
    const weekPost = closed.find((c) => c.weekId === prevWeekId)?.weekPost || (await store.getWeekPost(prevWeekId))
    const users = await getAllUsers()
    const sent = await pusher.sendAll(planWeekResultPushes(weekPost, users))
    console.log(`weeklyClose: closed [${closed.map((c) => c.weekId).join(', ')}], ${sent} result push(es) for ${prevWeekId}`)
  }
)

// ── 2. Reminders ─────────────────────────────────────────────

export const mondayKickoff = onSchedule(
  { schedule: 'every monday 09:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const [{ users, workouts }, habits] = await Promise.all([loadWeekState(weekId), getCollection(db, 'habits')])
    const sent = await pusher.sendAll(planKickoff({ users, habits, workouts, weekId, today: todayYMD() }))
    console.log(`mondayKickoff: ${sent} push(es)`)
  }
)

export const midweekReminder = onSchedule(
  { schedule: 'every thursday 09:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const { users, workouts } = await loadWeekState(weekId)
    const sent = await pusher.sendAll(planMidweek({ users, workouts, weekId, today: todayYMD() }))
    console.log(`midweekReminder: ${sent} push(es)`)
  }
)

export const lastCallReminder = onSchedule(
  { schedule: 'every sunday 17:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const { users, workouts } = await loadWeekState(weekId)
    const sent = await pusher.sendAll(planLastCall({ users, workouts, weekId, today: todayYMD() }))
    console.log(`lastCallReminder: ${sent} push(es)`)
  }
)

export const habitReminder = onSchedule(
  { schedule: 'every day 20:30', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const [users, habits, habitWeeksSnap] = await Promise.all([
      getAllUsers(),
      getCollection(db, 'habits'),
      db.collection('habit_weeks').where('weekId', '==', weekId).get(),
    ])
    const habitWeeks = habitWeeksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const sent = await pusher.sendAll(planHabitReminders({ users, habits, habitWeeks, weekId, today: todayYMD() }))
    console.log(`habitReminder: ${sent} push(es)`)
  }
)

// ── 3. Social pushes ─────────────────────────────────────────

const beforeAfter = (event) => [event.data?.before?.data(), event.data?.after?.data()]

export const onWorkoutCreated = onDocumentCreated(
  { document: 'workouts/{workoutId}', maxInstances: 3 },
  async (event) => {
    const w = event.data?.data()
    if (!w?.userId) return
    await pusher.sendAll(planWorkoutCreated(w, await getAllUsers()))
  }
)

export const onWorkoutUpdated = onDocumentUpdated(
  { document: 'workouts/{workoutId}', maxInstances: 3 },
  async (event) => {
    const [before, after] = beforeAfter(event)
    if (!before || !after?.userId) return
    const plan = planOwnerEngagement('workout', before, after, await getAllUsers())
    await pusher.sendAll(plan)
  }
)

export const onUnlockCreated = onDocumentCreated(
  { document: 'achievement_unlocks/{unlockId}', maxInstances: 3 },
  async (event) => {
    const unlock = event.data?.data()
    if (!unlock?.userId || unlock.seeded) return
    await pusher.sendAll(planUnlockCreated(unlock, await getAllUsers()))
  }
)

export const onUnlockUpdated = onDocumentUpdated(
  { document: 'achievement_unlocks/{unlockId}', maxInstances: 3 },
  async (event) => {
    const [before, after] = beforeAfter(event)
    if (!before || !after?.userId) return
    await pusher.sendAll(planOwnerEngagement('unlock', before, after, await getAllUsers()))
  }
)

export const onGoalCreated = onDocumentCreated(
  { document: 'goals/{goalId}', maxInstances: 3 },
  async (event) => {
    const goal = event.data?.data()
    if (!goal?.userId) return
    await pusher.sendAll(planGoalCreated(goal, await getAllUsers()))
  }
)

export const onGoalUpdated = onDocumentUpdated(
  { document: 'goals/{goalId}', maxInstances: 3 },
  async (event) => {
    const [before, after] = beforeAfter(event)
    if (!before || !after?.userId) return
    const users = await getAllUsers()
    await pusher.sendAll([
      ...planGoalAchieved(before, after, users),
      ...planOwnerEngagement('goal', before, after, users),
    ])
  }
)

export const onWeekPostUpdated = onDocumentUpdated(
  { document: 'week_posts/{weekId}', maxInstances: 3 },
  async (event) => {
    const [before, after] = beforeAfter(event)
    if (!before || !after) return
    const plan = planWeekPostComments(before, after, await getAllUsers(), event.params.weekId)
    await pusher.sendAll(plan)
  }
)

// ── 4. Nudge ─────────────────────────────────────────────────

export const sendNudge = onCall(
  { maxInstances: 5 },
  async (request) => {
    const { targetUserId, senderName } = request.data || {}
    if (!targetUserId || !senderName) {
      throw new HttpsError('invalid-argument', 'targetUserId and senderName are required.')
    }
    const targetSnap = await db.collection('users').doc(String(targetUserId)).get()
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user not found.')

    const target = { id: targetSnap.id, ...targetSnap.data() }
    if (tokensFor(target).length === 0) {
      return { success: false, reason: 'Esta persona no tiene las notificaciones activadas.' }
    }
    await pusher.sendToUser(target, nudgeCopy(String(senderName)))
    return { success: true }
  }
)

// ── 5. AI recaps (callables; also used by weeklyClose) ───────

function recapError(err, what) {
  if (err?.code === 'not-found') return new HttpsError('not-found', err.message)
  console.error(`${what} recap generation error:`, err)
  return new HttpsError('internal', `Error generando el resumen ${what}.`)
}

export const generateWeeklyRecap = onCall(
  { secrets: [openaiApiKey], maxInstances: 2 },
  async (request) => {
    const { weekId } = request.data || {}
    if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
      throw new HttpsError('invalid-argument', 'weekId is required.')
    }
    try {
      return await getOrCreateWeeklyRecap({ db, makeClient: makeOpenAI, weekId })
    } catch (err) {
      throw recapError(err, 'semanal')
    }
  }
)

export const generateMonthlyRecap = onCall(
  { secrets: [openaiApiKey], maxInstances: 2 },
  async (request) => {
    const { monthId } = request.data || {} // "YYYY-MM"
    if (!monthId || !/^\d{4}-\d{2}$/.test(monthId)) {
      throw new HttpsError('invalid-argument', 'monthId (YYYY-MM) is required.')
    }
    try {
      return await getOrCreateMonthlyRecap({ db, makeClient: makeOpenAI, monthId })
    } catch (err) {
      throw recapError(err, 'mensual')
    }
  }
)

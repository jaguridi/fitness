/**
 * FitFamily — Firebase Cloud Functions
 *
 * Scheduled (America/Santiago):
 *   - Monday   00:10 → weeklyClose: server-side week-end settlement + result push
 *   - Monday   09:00 → new week kickoff (state-aware)
 *   - Thursday 09:00 → mid-week reminder if clearly behind (state-aware)
 *   - Sunday   17:00 → last call if goal not yet met (state-aware)
 *
 * Firestore triggers (social pushes):
 *   - workout created            → notify the rest of the family
 *   - workout comment/reaction   → notify the workout owner
 *   - justification pending_vote → notify the voters
 *
 * Game math lives in ./game/ — AUTO-GENERATED copies of src/game/ kept in sync
 * by scripts/sync-game.mjs (wired as a predeploy hook in firebase.json).
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
import Anthropic from '@anthropic-ai/sdk'

import { getWeekId, getPreviousWeekId } from './game/weekId.js'
import {
  computeWeekRequirements,
  computeSessionsJustified,
} from './game/absences.js'
import { computeWeekEndOutcome, getSimulationWeeks } from './game/weekEnd.js'
import { USER_IDS } from './game/constants.js'

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

initializeApp()
const db = getFirestore()
const TIMEZONE = 'America/Santiago'

const APP_ICON = 'https://jaguridi.github.io/fitness/avatars/jose.png'

const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)

// ── Firestore fetch helpers ───────────────────────────────────
async function getAllUsers() {
  const snap = await db.collection('users').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function getAllAbsences() {
  const snap = await db.collection('absences').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function getJustificationsForWeek(weekId) {
  const snap = await db.collection('justifications').where('weekId', '==', weekId).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function getWorkoutsForWeek(weekId) {
  const snap = await db.collection('workouts').where('weekId', '==', weekId).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function getSessionCount(userId, weekId) {
  const snap = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .where('weekId', '==', weekId)
    .get()
  return snap.size
}

// ── Push helpers (multi-device) ───────────────────────────────
// Tokens live in users/{id}.fcmTokens (array, one per device) with the legacy
// single fcmToken field still honored. Dead tokens are pruned on send.

function tokensFor(user) {
  const tokens = [...(user.fcmTokens || []), user.fcmToken].filter(Boolean)
  return [...new Set(tokens)]
}

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

async function pruneToken(userId, token) {
  try {
    const ref = db.collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data()
    const update = { fcmTokens: FieldValue.arrayRemove(token) }
    if (data.fcmToken === token) update.fcmToken = FieldValue.delete()
    await ref.update(update)
    console.log(`Pruned dead FCM token for ${userId}`)
  } catch (err) {
    console.warn(`Could not prune token for ${userId}: ${err.message}`)
  }
}

/** Send a push to every device a user has registered. */
async function sendPushToUser(user, title, body, tag = 'fitfamily-reminder') {
  const tokens = tokensFor(user)
  if (tokens.length === 0) return
  await Promise.all(tokens.map(async (token) => {
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        webpush: {
          notification: { icon: APP_ICON, badge: APP_ICON, tag },
        },
      })
    } catch (err) {
      if (DEAD_TOKEN_CODES.has(err.code)) {
        await pruneToken(user.id, token)
      } else {
        console.warn(`FCM send failed for ${user.id}: ${err.message}`)
      }
    }
  }))
}

// ── Week-state helper for reminders ───────────────────────────
// What does this user still owe this week, accounting for frozen weeks,
// legacy recovery sessions, and accepted/pending justifications?
async function getWeekObligation(user, weekId, absences, justifications) {
  const { totalRequired, fullyFrozen, recoverySessions } =
    computeWeekRequirements(user.id, weekId, absences)
  if (fullyFrozen) return { fullyFrozen: true, missing: 0, target: 0, sessions: 0, recoverySessions }
  const justified = computeSessionsJustified(user.id, weekId, justifications)
  const target = Math.max(0, totalRequired - justified)
  const sessions = await getSessionCount(user.id, weekId)
  return {
    fullyFrozen: false,
    target,
    sessions,
    missing: Math.max(0, target - sessions),
    recoverySessions,
  }
}

// ── 1. Monday kickoff ─────────────────────────────────────────
export const mondayKickoff = onSchedule(
  { schedule: 'every monday 09:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const [users, absences] = await Promise.all([getAllUsers(), getAllAbsences()])
    await Promise.all(
      users.map(async (u) => {
        const { fullyFrozen, totalRequired, recoverySessions } =
          computeWeekRequirements(u.id, weekId, absences)
        if (fullyFrozen) {
          await sendPushToUser(
            u,
            '🧊 Semana congelada',
            `Hola ${u.name}! Esta semana está congelada para ti — descansa tranquilo.`
          )
          return
        }
        const extra = recoverySessions > 0
          ? ` (incluye ${recoverySessions} de recuperación)`
          : ''
        await sendPushToUser(
          u,
          '💪 ¡Nueva semana FitFamily!',
          `Hola ${u.name}! Meta: ${totalRequired} sesiones esta semana${extra}. ¡A moverse!`
        )
      })
    )
    console.log(`Monday kickoff sent to ${users.length} users`)
  }
)

// ── 2. Thursday mid-week reminder ────────────────────────────
export const midweekReminder = onSchedule(
  { schedule: 'every thursday 09:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const [users, absences, justifications] = await Promise.all([
      getAllUsers(),
      getAllAbsences(),
      getJustificationsForWeek(weekId),
    ])
    await Promise.all(
      users.map(async (u) => {
        const ob = await getWeekObligation(u, weekId, absences, justifications)
        // Only nag when clearly behind (2+ sessions missing by Thursday).
        if (ob.fullyFrozen || ob.missing < 2) return
        await sendPushToUser(
          u,
          '⚠️ Recordatorio FitFamily',
          `${u.name}, llevas ${ob.sessions} de ${ob.target} sesiones. ¡Quedan 4 días para completar la meta!`
        )
      })
    )
    console.log(`Thursday reminder checked for ${users.length} users`)
  }
)

// ── 3. Sunday last call ───────────────────────────────────────
export const lastCallReminder = onSchedule(
  { schedule: 'every sunday 17:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const [users, absences, justifications] = await Promise.all([
      getAllUsers(),
      getAllAbsences(),
      getJustificationsForWeek(weekId),
    ])
    await Promise.all(
      users.map(async (u) => {
        const ob = await getWeekObligation(u, weekId, absences, justifications)
        if (ob.fullyFrozen || ob.missing === 0) return
        const lifeNote = ob.missing === 1 && (u.extraLives || 0) > 0
          ? ' Tienes una vida 💖 que te salvaría, pero úsala con sabiduría.'
          : ''
        await sendPushToUser(
          u,
          '🚨 ¡Último día FitFamily!',
          `${u.name}, te falta${ob.missing > 1 ? 'n' : ''} ${ob.missing} sesión(es). ¡Hoy es el último día!${lifeNote}`
        )
      })
    )
    console.log(`Sunday last call checked for ${users.length} users`)
  }
)

// ── 4. Weekly close — server-side settlement (Monday 00:10) ───
// Mirrors the client's auto-processing exactly (same shared game logic, same
// transactional claim on settings/meta), so whoever runs first wins and the
// other side skips. With this in place the close no longer depends on someone
// opening the app.

const metaRef = () => db.collection('settings').doc('meta')
const CLAIM_TTL_MS = 5 * 60 * 1000

async function claimWeek(weekId) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(metaRef())
    const meta = snap.exists ? snap.data() : {}
    if ((meta.lastAutoProcessedWeekId || '') >= weekId) return false
    const p = meta.processing
    const startedAt = p?.startedAt?.toMillis?.() ?? 0
    if (p?.weekId === weekId && Date.now() - startedAt < CLAIM_TTL_MS) return false
    tx.set(metaRef(), { processing: { weekId, startedAt: FieldValue.serverTimestamp() } }, { merge: true })
    return true
  })
}

async function fetchSessionsByUserWeek(weekIds) {
  const sessionsByUserWeek = {}
  await Promise.all(weekIds.map(async (wk) => {
    const ws = await getWorkoutsForWeek(wk)
    for (const w of ws) {
      if (!sessionsByUserWeek[w.userId]) sessionsByUserWeek[w.userId] = {}
      sessionsByUserWeek[w.userId][wk] = (sessionsByUserWeek[w.userId][wk] || 0) + 1
    }
  }))
  return sessionsByUserWeek
}

async function runWeekEndServer(weekId) {
  const [users, absences, weekWorkouts, weekJustifications] = await Promise.all([
    getAllUsers(),
    getAllAbsences(),
    getWorkoutsForWeek(weekId),
    getJustificationsForWeek(weekId),
  ])
  const sessionsByUserWeek = await fetchSessionsByUserWeek(
    getSimulationWeeks(weekId, absences)
  )

  const { userUpdates, summaries, absenceUpdates } = computeWeekEndOutcome({
    weekId,
    userIds: USER_IDS,
    users,
    absences,
    weekWorkouts,
    weekJustifications,
    sessionsByUserWeek,
  })

  for (const { userId, data } of userUpdates) {
    await db.collection('users').doc(userId).set(data, { merge: true })
  }
  for (const { userId, weekId: wk, data } of summaries) {
    await db.collection('weekly_summaries').doc(`${userId}_${wk}`).set({
      userId,
      weekId: wk,
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
  for (const { absenceId, data } of absenceUpdates) {
    await db.collection('absences').doc(absenceId).update(data)
  }
}

/** Push each user their result for the just-closed week. */
async function sendWeekCloseResults(weekId) {
  const [users, summSnap] = await Promise.all([
    getAllUsers(),
    db.collection('weekly_summaries').where('weekId', '==', weekId).get(),
  ])
  const totalPot = users.reduce((s, u) => s + (u.walletBalance || 0), 0)
  const potNote = ` Pozo familiar: ${formatCLP(totalPot)}.`

  await Promise.all(summSnap.docs.map(async (d) => {
    const s = d.data()
    const user = users.find((u) => u.id === s.userId)
    if (!user) return

    let title = '📋 Cierre de semana'
    let body = ''
    if (s.status === 'frozen') {
      title = '🧊 Semana congelada'
      body = 'Semana congelada — sin cambios para ti.'
    } else if (s.status === 'missed') {
      title = '💸 Semana no cumplida'
      body = `Multa de ${formatCLP(s.fineApplied || 0)}.` +
        ` Tu próxima multa sería ${formatCLP(user.currentFineLevel || 0)}.`
      if (s.fineReducedByCanje > 0) {
        body += ` Tus extras canjearon ${formatCLP(s.fineReducedByCanje)}. 🏦`
      }
    } else if (s.status === 'justified') {
      title = '⚖️ Semana justificada'
      body = 'Justificación aceptada — sin multa, pero la racha se reinicia.'
    } else {
      title = s.lifeUsed ? '💖 ¡Te salvó una vida!' : '✅ Semana cumplida'
      body = s.lifeUsed
        ? 'Usaste una vida extra para completar la meta.'
        : `${s.sessions}/${s.totalRequired} sesiones. ¡Bien ahí!`
      if (s.lifeEarned) body += ' Ganaste una vida extra 💖.'
      if (s.shieldEarned) body += ' ¡Escudo activado! 🛡️'
      if (s.extrasRedeemed > 0) body += ` Canjeaste extras por ${formatCLP(s.fineReducedByCanje)} 🏦.`
    }

    await sendPushToUser(user, title, body + potNote, 'fitfamily-weekclose')
  }))
}

export const weeklyClose = onSchedule(
  { schedule: 'every monday 00:10', timeZone: TIMEZONE, maxInstances: 1 },
  async () => {
    const currentWeekId = getWeekId()
    const prevWeekId = getPreviousWeekId(currentWeekId)
    const metaSnap = await metaRef().get()
    const lastProcessed = metaSnap.exists ? metaSnap.data().lastAutoProcessedWeekId : undefined

    // Walk back from prevWeekId until we hit lastProcessed, building the queue.
    const pending = []
    let cursor = prevWeekId
    for (let i = 0; i < 52 && cursor && cursor !== lastProcessed; i++) {
      pending.unshift(cursor)
      cursor = getPreviousWeekId(cursor)
    }
    // No lock yet (fresh install): only process the week that just ended.
    const weeksToProcess = (lastProcessed && cursor === lastProcessed)
      ? pending
      : (prevWeekId ? [prevWeekId] : [])

    let processed = 0
    for (const wk of weeksToProcess) {
      const claimed = await claimWeek(wk)
      if (!claimed) {
        console.log(`weeklyClose: ${wk} already claimed/processed, stopping`)
        break
      }
      await runWeekEndServer(wk)
      await metaRef().set({
        lastAutoProcessedWeekId: wk,
        processing: FieldValue.delete(),
      }, { merge: true })
      processed++
      console.log(`weeklyClose: processed ${wk}`)
    }

    // Always notify results for the week that just ended, no matter who closed it.
    await sendWeekCloseResults(prevWeekId)
    console.log(`weeklyClose: done (${processed} week(s) processed, results sent for ${prevWeekId})`)
  }
)

// ── 5. Social pushes — workout / comments / reactions / votes ──

function formatTypes(workout) {
  if (Array.isArray(workout?.exerciseType)) return workout.exerciseType.join(' + ')
  return workout?.exerciseType || 'Ejercicio'
}

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '')

export const onWorkoutCreated = onDocumentCreated(
  { document: 'workouts/{workoutId}', maxInstances: 3 },
  async (event) => {
    const w = event.data?.data()
    if (!w?.userId) return
    const users = await getAllUsers()
    const owner = users.find((u) => u.id === w.userId)
    const name = owner?.name || 'Alguien'
    const body = `${formatTypes(w)} · ${w.duration || '?'} min. ¡A seguirle el ritmo!`
    await Promise.all(
      users
        .filter((u) => u.id !== w.userId)
        .map((u) => sendPushToUser(u, `💪 ${name} entrenó`, body, 'fitfamily-social'))
    )
  }
)

export const onWorkoutUpdated = onDocumentUpdated(
  { document: 'workouts/{workoutId}', maxInstances: 3 },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()
    if (!before || !after?.userId) return

    const users = await getAllUsers()
    const owner = users.find((u) => u.id === after.userId)
    if (!owner) return

    // New comments → notify the workout owner
    const beforeCount = before.comments?.length || 0
    const afterComments = after.comments || []
    for (const c of afterComments.slice(beforeCount)) {
      if (!c?.userId || c.userId === owner.id) continue
      const commenter = users.find((u) => u.id === c.userId)
      await sendPushToUser(
        owner,
        `💬 ${commenter?.name || 'Alguien'} comentó tu ejercicio`,
        truncate(c.text, 120),
        'fitfamily-social'
      )
    }

    // New/changed reactions → notify the workout owner
    const beforeReactions = before.reactions || {}
    for (const [uid, emoji] of Object.entries(after.reactions || {})) {
      if (uid === owner.id || beforeReactions[uid] === emoji) continue
      const reactor = users.find((u) => u.id === uid)
      await sendPushToUser(
        owner,
        `${emoji} ${reactor?.name || 'Alguien'} reaccionó`,
        `A tu ${formatTypes(after)} del ${after.date || 'otro día'}.`,
        'fitfamily-social'
      )
    }
  }
)

async function notifyPendingVote(justification) {
  const users = await getAllUsers()
  const owner = users.find((u) => u.id === justification.userId)
  const name = owner?.name || 'Alguien'
  await Promise.all(
    users
      .filter((u) => u.id !== justification.userId)
      .map((u) => sendPushToUser(
        u,
        `⚖️ ${name} necesita tu voto`,
        `Su justificación va a votación familiar: "${truncate(justification.excuse, 80)}"`,
        'fitfamily-vote'
      ))
  )
}

export const onJustificationCreated = onDocumentCreated(
  { document: 'justifications/{justificationId}', maxInstances: 3 },
  async (event) => {
    const j = event.data?.data()
    if (j?.status === 'pending_vote') await notifyPendingVote(j)
  }
)

export const onJustificationUpdated = onDocumentUpdated(
  { document: 'justifications/{justificationId}', maxInstances: 3 },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()
    if (after?.status === 'pending_vote' && before?.status !== 'pending_vote') {
      await notifyPendingVote(after)
    }
  }
)

// ── 6. Nudge — Send a motivational push to a family member ────
export const sendNudge = onCall(
  { maxInstances: 5 },
  async (request) => {
    const { targetUserId, senderName } = request.data
    if (!targetUserId || !senderName) {
      throw new HttpsError('invalid-argument', 'targetUserId and senderName are required.')
    }

    const targetSnap = await db.collection('users').doc(targetUserId).get()
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Target user not found.')
    }

    const target = { id: targetSnap.id, ...targetSnap.data() }
    if (tokensFor(target).length === 0) {
      return { success: false, reason: 'El usuario no tiene notificaciones activas.' }
    }

    const nudgeMessages = [
      `${senderName} te manda un empujón 💪 ¡A moverse!`,
      `${senderName} dice: "¡No te quedes atrás!" 🏃‍♂️`,
      `${senderName} te reta a entrenar hoy 🔥`,
      `${senderName} cree en ti... pero necesita verte sudar 😤`,
      `${senderName} pregunta: "¿Esa multa se paga sola?" 💸`,
    ]
    const body = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)]

    await sendPushToUser(target, '👊 ¡Empujón FitFamily!', body, 'fitfamily-nudge')
    return { success: true }
  }
)

// ── 7. Weekly Recap — Generate a fun AI-powered summary ───────
export const generateWeeklyRecap = onCall(
  { secrets: [anthropicApiKey], maxInstances: 2 },
  async (request) => {
    const { weekId } = request.data
    if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required.')

    // Check if recap already exists
    const existingRecap = await db.collection('weekly_recaps').doc(weekId).get()
    if (existingRecap.exists) {
      return existingRecap.data()
    }

    // Gather all summaries for the week
    const summSnap = await db.collection('weekly_summaries')
      .where('weekId', '==', weekId).get()
    if (summSnap.empty) {
      throw new HttpsError('not-found', 'No hay resúmenes para esta semana.')
    }

    // Gather user names
    const usersSnap = await db.collection('users').get()
    const usersMap = {}
    usersSnap.docs.forEach((d) => { usersMap[d.id] = d.data().name || d.id })

    // Build summary data
    const summaries = summSnap.docs.map((d) => {
      const data = d.data()
      return {
        name: usersMap[data.userId] || data.userId,
        sessions: data.sessions || 0,
        totalRequired: data.totalRequired || 3,
        status: data.status,
        fineApplied: data.fineApplied || 0,
        lifeUsed: data.lifeUsed || false,
        lifeEarned: data.lifeEarned || false,
        shieldEarned: data.shieldEarned || false,
        shieldBroken: data.shieldBroken || false,
      }
    })

    const summaryText = summaries.map((s) => {
      const parts = [`${s.name}: ${s.sessions}/${s.totalRequired} sesiones, estado=${s.status}`]
      if (s.fineApplied > 0) parts.push(`multa=$${s.fineApplied}`)
      if (s.lifeUsed) parts.push('usó vida')
      if (s.lifeEarned) parts.push('ganó vida extra')
      if (s.shieldEarned) parts.push('ganó escudo')
      if (s.shieldBroken) parts.push('perdió escudo')
      return parts.join(', ')
    }).join('\n')

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `Eres el narrador divertido del reto fitness familiar "FitFamily".
Genera un resumen semanal breve y entretenido (máximo 4-5 frases) en español chileno informal.
Usa humor, sarcasmo cariñoso y referencias deportivas. Celebra a los que cumplieron y molesta (con cariño) a los que no.
Incluye 2-3 emojis. NO uses formato markdown. Solo texto plano con saltos de línea.
Si alguien ganó un escudo o vida extra, celébralo. Si alguien pagó multa, menciónalo con humor.`,
        messages: [{
          role: 'user',
          content: `Resumen de la semana ${weekId}:\n${summaryText}`,
        }],
      })

      const recap = msg.content[0]?.text || 'No se pudo generar el resumen.'

      // Store in Firestore
      const recapData = { weekId, recap, summaries, createdAt: new Date() }
      await db.collection('weekly_recaps').doc(weekId).set(recapData)

      return recapData
    } catch (err) {
      console.error('Weekly recap generation error:', err)
      throw new HttpsError('internal', 'Error generando el resumen semanal.')
    }
  }
)

// ── 7b. Monthly Recap — Generate a fun AI-powered monthly summary ──
export const generateMonthlyRecap = onCall(
  { secrets: [anthropicApiKey], maxInstances: 2 },
  async (request) => {
    const { monthId } = request.data // format: "YYYY-MM"
    if (!monthId || !/^\d{4}-\d{2}$/.test(monthId)) {
      throw new HttpsError('invalid-argument', 'monthId (YYYY-MM) is required.')
    }

    // Cache check
    const existing = await db.collection('monthly_recaps').doc(monthId).get()
    if (existing.exists) {
      return existing.data()
    }

    const [year, month] = monthId.split('-').map(Number)
    // Build list of weekIds that fall in this month (any week whose Monday
    // is in the month, OR which spans into it).
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59)

    // Fetch all summaries; filter by parsed weekId end-of-week falling in month
    const summSnap = await db.collection('weekly_summaries').get()
    const usersSnap = await db.collection('users').get()
    const usersMap = {}
    usersSnap.docs.forEach((d) => { usersMap[d.id] = d.data().name || d.id })

    function weekIdToMonday(weekId) {
      const [yStr, wStr] = weekId.split('-W')
      const y = Number(yStr)
      const w = Number(wStr)
      const jan1 = new Date(y, 0, 1)
      const jan1Day = jan1.getDay() || 7
      const jan1Monday = new Date(y, 0, 1 + (1 - jan1Day))
      return new Date(jan1Monday.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000)
    }

    const monthSummaries = summSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => {
        if (!s.weekId) return false
        const mon = weekIdToMonday(s.weekId)
        return mon >= monthStart && mon <= monthEnd
      })

    if (monthSummaries.length === 0) {
      throw new HttpsError('not-found', 'No hay datos para este mes.')
    }

    // Workouts for the month (filter by date field)
    const workoutsSnap = await db.collection('workouts').get()
    const monthWorkouts = workoutsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((w) => {
        if (!w.date) return false
        const d = new Date(w.date + 'T12:00:00')
        return d >= monthStart && d <= monthEnd
      })

    // Aggregate per user
    const perUser = {}
    for (const s of monthSummaries) {
      if (!perUser[s.userId]) {
        perUser[s.userId] = {
          name: usersMap[s.userId] || s.userId,
          sessions: 0,
          weeksCompleted: 0,
          weeksMissed: 0,
          weeksJustified: 0,
          weeksFrozen: 0,
          finesPaid: 0,
          minutes: 0,
          calories: 0,
        }
      }
      const u = perUser[s.userId]
      u.sessions += s.sessions || 0
      u.finesPaid += s.fineApplied || 0
      if (s.status === 'completed' || s.lifeUsed) u.weeksCompleted++
      else if (s.status === 'missed') u.weeksMissed++
      else if (s.status === 'justified') u.weeksJustified++
      else if (s.status === 'frozen') u.weeksFrozen++
    }
    for (const w of monthWorkouts) {
      const u = perUser[w.userId]
      if (!u) continue
      u.minutes += w.duration || 0
      u.calories += w.calories || 0
    }

    const summaryText = Object.values(perUser).map((u) => {
      const parts = [
        `${u.name}: ${u.sessions} sesiones, ${u.minutes} min`,
        `${u.weeksCompleted}/${u.weeksCompleted + u.weeksMissed + u.weeksJustified} semanas cumplidas`,
      ]
      if (u.weeksMissed > 0) parts.push(`${u.weeksMissed} fallidas`)
      if (u.weeksJustified > 0) parts.push(`${u.weeksJustified} justificadas`)
      if (u.weeksFrozen > 0) parts.push(`${u.weeksFrozen} congeladas`)
      if (u.finesPaid > 0) parts.push(`multas=$${u.finesPaid}`)
      if (u.calories > 0) parts.push(`${u.calories} kcal`)
      return parts.join(', ')
    }).join('\n')

    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const monthLabel = `${monthNames[month - 1]} ${year}`

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `Eres el narrador del reto fitness familiar "FitFamily". Escribe un recap mensual
en español chileno informal (6-8 frases) con humor cariñoso y referencias deportivas.
Estructura sugerida:
1. Una oración de apertura sobre el mes
2. Quién destacó (positivo)
3. Quién quedó debiendo (con humor, no cruel)
4. Algún dato curioso (sesiones totales, kcal, tendencia vs mes anterior si está clara)
5. Una proyección o consejo para el mes siguiente

No uses markdown. Solo texto plano con saltos de línea. Máximo 3 emojis en total.`,
        messages: [{
          role: 'user',
          content: `Resumen mensual de ${monthLabel}:\n${summaryText}`,
        }],
      })

      const recap = msg.content[0]?.text || 'No se pudo generar el resumen.'
      const recapData = {
        monthId,
        monthLabel,
        recap,
        perUser: Object.values(perUser),
        totals: {
          sessions: monthWorkouts.length,
          minutes: monthWorkouts.reduce((s, w) => s + (w.duration || 0), 0),
          calories: monthWorkouts.reduce((s, w) => s + (w.calories || 0), 0),
        },
        createdAt: new Date(),
      }
      await db.collection('monthly_recaps').doc(monthId).set(recapData)
      return recapData
    } catch (err) {
      console.error('Monthly recap generation error:', err)
      throw new HttpsError('internal', 'Error generando el resumen mensual.')
    }
  }
)

// ── 8. AI Judge — Evaluate justifications with Claude ─────────

const AI_JUDGE_PROMPT = `Eres el juez estricto pero justo del reto fitness familiar "FitFamily".

CONTEXTO:
- 4 miembros de una familia deben completar 3 sesiones de ejercicio por semana
- Si no cumplen, pagan una multa en pesos chilenos
- Existe un sistema de "semana congelada" para ausencias PREVISIBLES (viajes, vacaciones, etc.)
- Las justificaciones son SOLO para IMPREVISTOS (cosas que no se pudieron planificar)

CRITERIOS PARA ACEPTAR:
- Enfermedad súbita (gripe, COVID, infección) — idealmente con certificado médico o foto
- Lesión que impida ejercicio — con evidencia (foto, certificado)
- Emergencia familiar grave (hospitalización de familiar, accidente)
- Catástrofe natural o situación de fuerza mayor

CRITERIOS PARA RECHAZAR:
- "No tuve tiempo" / "Estuve ocupado" — siempre hay 30 min para ejercicio
- Flojera, cansancio, falta de motivación — eso es precisamente lo que el reto combate
- Viaje planificado — eso se congela con anticipación
- Clima — se puede ejercitar adentro
- Excusas vagas sin evidencia concreta
- Trabajo excesivo — se puede hacer ejercicio corto
- Cualquier situación que ERA previsible y se pudo planificar como semana congelada

SÉ ESTRICTO. El objetivo del reto es que NO haya excusas fáciles. Solo situaciones genuinamente fuera del control de la persona.

Si el usuario menciona evidencia (certificado, foto) pero no la adjunta, pídela.
Si adjunta una imagen, evalúala como evidencia.

Responde SOLO con un JSON válido (sin markdown, sin backticks):
{"valid": true/false, "reason": "explicación breve en español de máximo 2 frases"}`

export const evaluateJustification = onCall(
  { secrets: [anthropicApiKey], maxInstances: 5 },
  async (request) => {
    const { excuse, photoBase64 } = request.data
    if (!excuse || typeof excuse !== 'string' || excuse.trim().length < 15) {
      throw new HttpsError('invalid-argument', 'La justificación debe tener al menos 15 caracteres.')
    }

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() })

      // Build message content
      const content = []

      // Add photo if provided
      if (photoBase64 && photoBase64.startsWith('data:')) {
        const base64Data = photoBase64.split(',')[1]
        const mimeType = photoBase64.match(/data:(.*?);/)?.[1] || 'image/jpeg'
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64Data },
        })
      }

      content.push({
        type: 'text',
        text: `JUSTIFICACIÓN DEL USUARIO:\n"${excuse.trim()}"${photoBase64 ? '\n\n(El usuario adjuntó una imagen como evidencia. Evalúala.)' : ''}`,
      })

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: AI_JUDGE_PROMPT,
        messages: [{ role: 'user', content }],
      })

      const text = msg.content[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('Could not parse Claude response:', text)
        return { valid: false, reason: text || 'No se pudo interpretar la respuesta.', aiError: true }
      }

      const result = JSON.parse(jsonMatch[0])
      return { valid: Boolean(result.valid), reason: result.reason || 'Sin explicación.' }
    } catch (err) {
      console.error('Claude AI Judge error:', err)
      return {
        valid: false,
        reason: 'Error al evaluar la justificación. Será enviada a votación familiar.',
        aiError: true,
      }
    }
  }
)

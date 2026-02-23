/**
 * FitFamily — Firebase Cloud Functions
 * Scheduled push notification reminders via FCM.
 *
 * Schedules (America/Santiago = UTC-3 standard, UTC-4 DST):
 *   - Monday   09:00 → new week kickoff for everyone
 *   - Thursday 09:00 → mid-week reminder if behind (< 2 sessions)
 *   - Sunday   17:00 → last call if goal not yet met
 */

const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()
const db = getFirestore()
const TIMEZONE = 'America/Santiago'

// ── Week ID helper (mirrors client-side getWeekId) ────────────
function getWeekId(date = new Date()) {
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const jan1Day = jan1.getDay() || 7
  const jan1Monday = new Date(date.getFullYear(), 0, 1 + (1 - jan1Day))
  // Start of week (Monday)
  const dayOfWeek = date.getDay() || 7 // 1=Mon ... 7=Sun
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - (dayOfWeek - 1))
  weekStart.setHours(0, 0, 0, 0)
  const diff = weekStart - jan1Monday
  const weekNum = Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ── Fetch users with FCM tokens ───────────────────────────────
async function getUsersWithTokens() {
  const snap = await db.collection('users').get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.fcmToken)
}

// ── Count workouts for a user this week ───────────────────────
async function getSessionCount(userId, weekId) {
  const snap = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .where('weekId', '==', weekId)
    .get()
  return snap.size
}

// ── Send FCM message ─────────────────────────────────────────
async function sendPush(token, title, body) {
  try {
    await getMessaging().send({
      token,
      notification: { title, body },
      webpush: {
        notification: {
          icon: 'https://jaguridi.github.io/fitness/avatars/jose.png',
          badge: 'https://jaguridi.github.io/fitness/avatars/jose.png',
          tag: 'fitfamily-reminder',
        },
      },
    })
  } catch (err) {
    // Token may be stale — log but don't crash
    console.warn(`FCM send failed for token: ${err.message}`)
  }
}

// ── 1. Monday kickoff ─────────────────────────────────────────
exports.mondayKickoff = onSchedule(
  { schedule: 'every monday 09:00', timeZone: TIMEZONE },
  async () => {
    const users = await getUsersWithTokens()
    await Promise.all(
      users.map((u) =>
        sendPush(
          u.fcmToken,
          '💪 ¡Nueva semana FitFamily!',
          `Hola ${u.name}! Meta: 3 sesiones esta semana. ¡A moverse!`
        )
      )
    )
    console.log(`Monday kickoff sent to ${users.length} users`)
  }
)

// ── 2. Thursday mid-week reminder ────────────────────────────
exports.midweekReminder = onSchedule(
  { schedule: 'every thursday 09:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const users = await getUsersWithTokens()
    await Promise.all(
      users.map(async (u) => {
        const sessions = await getSessionCount(u.id, weekId)
        if (sessions < 2) {
          await sendPush(
            u.fcmToken,
            '⚠️ Recordatorio FitFamily',
            `${u.name}, llevas ${sessions} sesión(es). ¡Quedan 3 días para completar la meta!`
          )
        }
      })
    )
    console.log(`Thursday reminder checked for ${users.length} users`)
  }
)

// ── 3. Sunday last call ───────────────────────────────────────
exports.lastCallReminder = onSchedule(
  { schedule: 'every sunday 17:00', timeZone: TIMEZONE },
  async () => {
    const weekId = getWeekId()
    const users = await getUsersWithTokens()
    await Promise.all(
      users.map(async (u) => {
        const sessions = await getSessionCount(u.id, weekId)
        if (sessions < 3) {
          const missing = 3 - sessions
          await sendPush(
            u.fcmToken,
            '🚨 ¡Último día FitFamily!',
            `${u.name}, te falta${missing > 1 ? 'n' : ''} ${missing} sesión(es). ¡Hoy es el último día!`
          )
        }
      })
    )
    console.log(`Sunday last call checked for ${users.length} users`)
  }
)

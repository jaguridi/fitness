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
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const Anthropic = require('@anthropic-ai/sdk')

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

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

// ── 4. Nudge — Send a motivational push to a family member ────
exports.sendNudge = onCall(
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

    const target = targetSnap.data()
    if (!target.fcmToken) {
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

    await sendPush(target.fcmToken, '👊 ¡Empujón FitFamily!', body)
    return { success: true }
  }
)

// ── 5. Weekly Recap — Generate a fun AI-powered summary ───────
exports.generateWeeklyRecap = onCall(
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

// ── 5b. Monthly Recap — Generate a fun AI-powered monthly summary ──
exports.generateMonthlyRecap = onCall(
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

// ── 6. AI Judge — Evaluate justifications with Claude ─────────

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

exports.evaluateJustification = onCall(
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

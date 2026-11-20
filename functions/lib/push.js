// FCM web push plumbing (multi-device). Tokens live in users/{id}.fcmTokens
// (one per device) with the legacy single fcmToken still honored. Dead tokens
// are pruned on send.
//
// buildMessage/tokensFor are pure; createPusher takes the injected Admin
// messaging + Firestore so nothing initializes Firebase on import.

import { APP_ICON, APP_URL, TAGS } from './copy.js'

export function tokensFor(user) {
  const tokens = [...(user?.fcmTokens || []), user?.fcmToken].filter((t) => typeof t === 'string' && t)
  return [...new Set(tokens)]
}

export const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/**
 * FCM message for one device. The `notification` payload is shown by the
 * Firebase SDK in public/firebase-messaging-sw.js; `fcmOptions.link` opens
 * (or focuses) the app on click.
 */
export function buildMessage(token, { title, body, tag = TAGS.reminder, link = APP_URL }) {
  return {
    token,
    notification: { title, body },
    data: { url: link, tag },
    webpush: {
      notification: { icon: APP_ICON, badge: APP_ICON, tag },
      fcmOptions: { link },
    },
  }
}

/**
 * @param {{ messaging: { send(msg): Promise<any> }, db: object, FieldValue: object, log?: object }} deps
 */
export function createPusher({ messaging, db, FieldValue, log = console }) {
  async function pruneToken(userId, token) {
    try {
      const ref = db.collection('users').doc(userId)
      const snap = await ref.get()
      if (!snap.exists) return
      const update = { fcmTokens: FieldValue.arrayRemove(token) }
      if (snap.data().fcmToken === token) update.fcmToken = FieldValue.delete()
      await ref.update(update)
      log.log(`Pruned dead FCM token for ${userId}`)
    } catch (err) {
      log.warn(`Could not prune token for ${userId}: ${err.message}`)
    }
  }

  /** Send `copy` ({ title, body, tag, link }) to every device of `user`. Never throws. */
  async function sendToUser(user, copy) {
    if (!user || !copy) return 0
    const tokens = tokensFor(user)
    let sent = 0
    await Promise.all(tokens.map(async (token) => {
      try {
        await messaging.send(buildMessage(token, copy))
        sent++
      } catch (err) {
        if (DEAD_TOKEN_CODES.has(err.code)) await pruneToken(user.id, token)
        else log.warn(`FCM send failed for ${user.id}: ${err.message}`)
      }
    }))
    return sent
  }

  /** Send a list of { user, copy } (from the planners). */
  async function sendAll(list) {
    const counts = await Promise.all((list || []).map(({ user, copy }) => sendToUser(user, copy)))
    return counts.reduce((a, b) => a + b, 0)
  }

  return { sendToUser, sendAll, pruneToken }
}

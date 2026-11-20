/**
 * Web push (FCM) helpers. Only loaded by backend.firebase.js (dynamic import),
 * never in demo mode.
 */
import { getToken, onMessage } from 'firebase/messaging'
import { messagingPromise } from '../firebase.js'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Request notification permission and store the FCM token via `saveToken`.
 * Safe to call repeatedly — silently skips when unsupported or denied.
 * @param {string} userId
 * @param {(userId: string, token: string) => Promise<void>} saveToken
 * @returns {Promise<string|null>} the token, or null
 */
export async function registerPushToken(userId, saveToken) {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return null
  if (Notification.permission === 'denied') return null
  if (!VAPID_KEY) return null

  try {
    const messaging = await messagingPromise
    if (!messaging) return null
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) await saveToken(userId, token)
    return token
  } catch (err) {
    console.warn('Push token registration failed:', err)
    return null
  }
}

/** Listen for push messages while the app is in the foreground. Resolves an unsubscribe fn. */
export async function onForegroundMessage(callback) {
  const messaging = await messagingPromise
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}

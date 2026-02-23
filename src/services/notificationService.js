import { getToken, onMessage } from 'firebase/messaging'
import { messagingPromise } from '../firebase'
import { setUser } from './firebaseService'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Request push notification permission and store the FCM token in Firestore.
 * Safe to call multiple times — silently skips if already denied.
 */
export async function registerPushToken(userId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null
  if (Notification.permission === 'denied') return null
  if (!VAPID_KEY) return null

  try {
    const messaging = await messagingPromise
    if (!messaging) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) {
      await setUser(userId, { fcmToken: token })
    }
    return token
  } catch (err) {
    console.warn('Push token registration failed:', err)
    return null
  }
}

/**
 * Listen for push messages when the app is in the foreground.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(callback) {
  const messaging = await messagingPromise
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}

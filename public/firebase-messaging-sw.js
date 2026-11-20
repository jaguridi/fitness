// Firebase Cloud Messaging service worker — background pushes for FitFamily.
//
// The Cloud Functions send a `notification` payload with webpush.fcmOptions.link
// (https://fitness.jaguridi.cl/#/…). For those, the Firebase SDK itself shows
// the notification (icon, tag) and opens/focuses the app on click — so we must
// NOT show a second copy here (v1 did, which duplicated every push).
// onBackgroundMessage only covers data-only messages.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
})

const messaging = firebase.messaging()

// The app's root next to this service worker (works at any host/base path).
const APP_ROOT = new URL('./', self.location.href).href

messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return // already shown by the SDK
  const data = payload.data || {}
  if (!data.title) return
  self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: './avatars/jose.png',
    badge: './avatars/jose.png',
    tag: data.tag || 'fitfamily-reminder',
    data: { url: data.url || APP_ROOT },
  })
})

// Clicks on notifications shown above (the SDK handles its own and stops
// propagation before this runs). Opens the app, or focuses it if already open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || APP_ROOT, self.location.href)
  const url = target.origin === self.location.origin ? target.href : APP_ROOT
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((c) => c.url.startsWith(APP_ROOT))
    if (existing) {
      await existing.focus()
      if ('navigate' in existing && existing.url !== url) await existing.navigate(url).catch(() => {})
      return
    }
    await self.clients.openWindow(url)
  })())
})

// Firebase Cloud Messaging Service Worker
// Handles background push notifications for FitFamily

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

// Handle background messages (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'FitFamily 💪'
  const body = payload.notification?.body || ''
  self.registration.showNotification(title, {
    body,
    icon: '/fitness/avatars/jose.png',
    badge: '/fitness/avatars/jose.png',
    tag: 'fitfamily-reminder',
  })
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { tmpdir } from 'os'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // public/manifest.json is hand-written and already linked in index.html.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // The FCM service worker has its own registration — never precache or
        // intercept it.
        globIgnores: ['firebase-messaging-sw.js'],
        navigateFallback: '/fitness/index.html',
        navigateFallbackDenylist: [/firebase-messaging-sw\.js$/],
        runtimeCaching: [
          {
            // Workout/justification photos: immutable per URL → cache-first.
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'workout-photos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: '/fitness/',
  cacheDir: resolve(tmpdir(), '.vite-fitness'),
})

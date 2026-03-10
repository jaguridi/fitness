import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { tmpdir } from 'os'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/fitness/',
  cacheDir: resolve(tmpdir(), '.vite-fitness'),
})

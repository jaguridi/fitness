// Read-only export of every Firestore collection the app uses to a local JSON
// snapshot (scripts/dev-only/backups/, gitignored — it holds raw production docs).
// Usage: node scripts/dev-only/export-firestore.mjs [label]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

const COLLECTIONS = [
  'users',
  'workouts',
  'weekly_summaries',
  'absences',
  'justifications',
  'flagged_workouts',
  'achievement_unlocks',
  'weekly_recaps',
  'monthly_recaps',
  'settings',
  'habits',
  'habit_weeks',
  'week_posts',
  'goals',
]

const db = getFirestore(initializeApp(firebaseConfig))
const label = process.argv[2] || 'snapshot'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'backups')
mkdirSync(outDir, { recursive: true })

const out = { exportedAt: new Date().toISOString(), label, collections: {} }
for (const name of COLLECTIONS) {
  try {
    const snap = await getDocs(collection(db, name))
    out.collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
    console.log(`${name}: ${snap.size} docs`)
  } catch (err) {
    console.log(`${name}: skipped (${err.code || err.message})`)
  }
}

const file = join(outDir, `${label}-${stamp}.json`)
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`\nSaved ${file}`)
process.exit(0)

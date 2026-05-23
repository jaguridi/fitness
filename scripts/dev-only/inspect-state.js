// Read-only inspection of production Firestore state — users, meta, recent summaries.
// Usage: node scripts/dev-only/inspect-state.js
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const users = await getDocs(collection(db, 'users'))
console.log('USERS')
for (const d of users.docs) {
  const u = d.data()
  console.log(`  ${d.id} (${u.name}): wallet=${u.walletBalance ?? 0} fineLvl=${u.currentFineLevel ?? '?'} lives=${u.extraLives ?? 0} streak=${u.consecutiveSuccesses ?? 0} misses=${u.consecutiveMisses ?? 0} shield=${u.hasShield ?? false}`)
}

const meta = await getDoc(doc(db, 'settings', 'meta'))
console.log('\nMETA:', meta.exists() ? meta.data() : '(none)')

const absencesSnap = await getDocs(collection(db, 'absences'))
console.log(`\nABSENCES (${absencesSnap.size})`)
for (const d of absencesSnap.docs) {
  const a = d.data()
  const summary = a.frozenWeeks
    ? `frozenWeeks=${JSON.stringify(a.frozenWeeks)}`
    : `LEGACY frozenWeekId=${a.frozenWeekId} frozenSessions=${a.frozenSessions} recoveryWeeks=${JSON.stringify(a.recoveryWeeks)}`
  console.log(`  ${d.id} user=${a.userId} status=${a.status ?? '?'} ${summary}`)
}

const sumSnap = await getDocs(collection(db, 'weekly_summaries'))
const summaries = sumSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
summaries.sort((a, b) => (b.weekId || '').localeCompare(a.weekId || ''))
console.log(`\nALL WEEKLY SUMMARIES (${summaries.length} total)`)
let totalFines = 0
const byWeek = {}
for (const s of summaries) {
  if (!byWeek[s.weekId]) byWeek[s.weekId] = []
  byWeek[s.weekId].push(s)
  totalFines += s.fineApplied || 0
}
for (const wk of Object.keys(byWeek).sort()) {
  const weekSum = byWeek[wk].reduce((a, s) => a + (s.fineApplied || 0), 0)
  const parts = byWeek[wk].map((s) => `${s.userId}=${s.status}${s.fineApplied ? `(${s.fineApplied})` : ''}`).join(' ')
  console.log(`  ${wk} [Σfine=${weekSum}] ${parts}`)
}
console.log(`\nTotal fines across all summaries: ${totalFines}`)

process.exit(0)

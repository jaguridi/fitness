// One-off: set settings/meta.lastAutoProcessedWeekId so the next app load
// reprocesses subsequent weeks and reapplies missing fines.
// Usage: node scripts/dev-only/rewind-lock.js <weekId>
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

const target = process.argv[2]
if (!target || !/^\d{4}-W\d{2}$/.test(target)) {
  console.error('Usage: node scripts/dev-only/rewind-lock.js <weekId, e.g. 2026-W15>')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const ref = doc(db, 'settings', 'meta')
const before = await getDoc(ref)
console.log('Before:', before.exists() ? before.data() : '(none)')
await setDoc(ref, { lastAutoProcessedWeekId: target }, { merge: true })
const after = await getDoc(ref)
console.log('After:', after.data())
process.exit(0)

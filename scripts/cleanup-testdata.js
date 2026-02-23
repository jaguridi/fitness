/**
 * cleanup-testdata.js
 *
 * Deletes all test data from Firestore created before the current week (2026-W09).
 * Also resets all user game-state fields to initial values.
 *
 * Run with:  node scripts/cleanup-testdata.js
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
} from 'firebase/firestore'

// ── Firebase config (same as src/firebase.js) ────────────────────────────────
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

// ── Config ────────────────────────────────────────────────────────────────────
const CURRENT_WEEK = '2026-W09'   // keep this week and later; delete everything before
const USER_IDS = ['user1', 'user2', 'user3', 'user4']
const INITIAL_USER_STATE = {
  walletBalance: 0,
  currentFineLevel: 5000,
  consecutiveMisses: 0,
  consecutiveSuccesses: 0,
  extraLives: 0,
  hasShield: false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isOldWeek(weekId) {
  // String comparison works because format is "YYYY-WXX" (zero-padded)
  return weekId < CURRENT_WEEK
}

async function deleteQueryResults(collectionName, q) {
  const snap = await getDocs(q)
  if (snap.empty) {
    console.log(`  ${collectionName}: nothing to delete`)
    return 0
  }
  for (const d of snap.docs) {
    await deleteDoc(d.ref)
  }
  console.log(`  ${collectionName}: deleted ${snap.size} document(s)`)
  return snap.size
}

async function deleteAllInCollection(collectionName) {
  const snap = await getDocs(collection(db, collectionName))
  if (snap.empty) {
    console.log(`  ${collectionName}: nothing to delete`)
    return 0
  }
  for (const d of snap.docs) {
    await deleteDoc(d.ref)
  }
  console.log(`  ${collectionName}: deleted ${snap.size} document(s)`)
  return snap.size
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧹  Family Fitness — Test Data Cleanup`)
  console.log(`   Deleting all data before week ${CURRENT_WEEK}\n`)

  // 1. workouts — delete where weekId < CURRENT_WEEK
  console.log('1. Workouts...')
  const workoutsSnap = await getDocs(collection(db, 'workouts'))
  let workoutsDeleted = 0
  for (const d of workoutsSnap.docs) {
    if (isOldWeek(d.data().weekId)) {
      await deleteDoc(d.ref)
      workoutsDeleted++
    }
  }
  console.log(`   workouts: deleted ${workoutsDeleted} document(s)`)

  // 2. weekly_summaries — delete where weekId < CURRENT_WEEK
  console.log('2. Weekly summaries...')
  const summariesSnap = await getDocs(collection(db, 'weekly_summaries'))
  let summariesDeleted = 0
  for (const d of summariesSnap.docs) {
    if (isOldWeek(d.data().weekId)) {
      await deleteDoc(d.ref)
      summariesDeleted++
    }
  }
  console.log(`   weekly_summaries: deleted ${summariesDeleted} document(s)`)

  // 3. justifications — delete where weekId < CURRENT_WEEK
  console.log('3. Justifications...')
  const justSnap = await getDocs(collection(db, 'justifications'))
  let justDeleted = 0
  for (const d of justSnap.docs) {
    if (isOldWeek(d.data().weekId)) {
      await deleteDoc(d.ref)
      justDeleted++
    }
  }
  console.log(`   justifications: deleted ${justDeleted} document(s)`)

  // 4. flagged_workouts — delete ALL (all test data)
  console.log('4. Flagged workouts...')
  await deleteAllInCollection('flagged_workouts')

  // 5. absences — delete ALL (all test data)
  console.log('5. Absences...')
  await deleteAllInCollection('absences')

  // 6. Reset user game-state (keep name, avatar, pin — only reset game fields)
  console.log('6. Resetting user game state...')
  for (const userId of USER_IDS) {
    await setDoc(doc(db, 'users', userId), INITIAL_USER_STATE, { merge: true })
    console.log(`   ${userId}: reset`)
  }

  // 7. Set auto-processing lock so the app doesn't re-apply fines for W08
  console.log('7. Setting auto-processing lock...')
  const prevWeek = '2026-W08'
  await setDoc(doc(db, 'settings', 'meta'), { lastAutoProcessedWeekId: prevWeek }, { merge: true })
  console.log(`   settings/meta: lastAutoProcessedWeekId = ${prevWeek}`)

  console.log('\n✅  Cleanup complete! The app is ready for week 2026-W09.\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌  Cleanup failed:', err)
  process.exit(1)
})

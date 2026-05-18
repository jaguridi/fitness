/**
 * reset-firestore.js  ─  ⚠️ DESTRUCTIVE — wipes ALL game state ⚠️
 *
 * Replaces every user's walletBalance/fines/lives/etc. with the initial state
 * and deletes historical workouts/summaries/justifications/absences/flagged.
 *
 * This was originally `scripts/cleanup-testdata.js`. It was moved here and
 * gated because pointing it at the production Firebase project (which it does
 * by default) was wiping real fines for the whole family.
 *
 * Run with:
 *   FIRESTORE_RESET=YES_DESTROY_PRODUCTION_DATA node scripts/dev-only/reset-firestore.js --force
 *
 * Required to run:
 *   1. The env var FIRESTORE_RESET set to YES_DESTROY_PRODUCTION_DATA, AND
 *   2. The --force flag on the CLI, AND
 *   3. An interactive prompt where you type the project ID verbatim.
 */

import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore'

// ── Firebase config (same project as the live app) ───────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

// ── Config ───────────────────────────────────────────────────────────────────
const CURRENT_WEEK = process.env.RESET_CURRENT_WEEK || '2026-W09'
const USER_IDS = ['user1', 'user2', 'user3', 'user4']
const INITIAL_USER_STATE = {
  walletBalance: 0,
  currentFineLevel: 5000,
  consecutiveMisses: 0,
  consecutiveSuccesses: 0,
  extraLives: 0,
  hasShield: false,
}

// ── Safety guards ────────────────────────────────────────────────────────────
async function assertSafeToRun() {
  const hasForce = process.argv.includes('--force')
  const envOk = process.env.FIRESTORE_RESET === 'YES_DESTROY_PRODUCTION_DATA'

  if (!hasForce || !envOk) {
    console.error(`
❌  Refusing to run.

This script wipes ALL fines, lives, shields and historical data for project
"${firebaseConfig.projectId}". To run it you must:

  1. Set FIRESTORE_RESET=YES_DESTROY_PRODUCTION_DATA
  2. Pass --force on the command line
  3. Confirm the project ID interactively

Example:
  FIRESTORE_RESET=YES_DESTROY_PRODUCTION_DATA \\
    node scripts/dev-only/reset-firestore.js --force
`)
    process.exit(1)
  }

  const rl = readline.createInterface({ input, output })
  console.warn(`\n⚠️  About to DESTROY data in Firebase project: ${firebaseConfig.projectId}`)
  console.warn(`    - Resets walletBalance/lives/shields for ${USER_IDS.length} users`)
  console.warn(`    - Deletes workouts, summaries and justifications before ${CURRENT_WEEK}`)
  console.warn(`    - Deletes ALL absences and flagged_workouts`)
  const typed = await rl.question(`\nType the project ID to confirm ("${firebaseConfig.projectId}"): `)
  rl.close()

  if (typed.trim() !== firebaseConfig.projectId) {
    console.error('\n❌  Project ID mismatch. Aborting.')
    process.exit(1)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isOldWeek(weekId) {
  return weekId < CURRENT_WEEK
}

async function deleteAllInCollection(db, collectionName) {
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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await assertSafeToRun()

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  console.log(`\n🧹  Resetting Firestore project ${firebaseConfig.projectId}`)
  console.log(`   Cutoff week: ${CURRENT_WEEK}\n`)

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

  console.log('4. Flagged workouts...')
  await deleteAllInCollection(db, 'flagged_workouts')

  console.log('5. Absences...')
  await deleteAllInCollection(db, 'absences')

  console.log('6. Resetting user game state...')
  for (const userId of USER_IDS) {
    await setDoc(doc(db, 'users', userId), INITIAL_USER_STATE, { merge: true })
    console.log(`   ${userId}: reset`)
  }

  console.log('7. Setting auto-processing lock...')
  const prevWeek = process.env.RESET_PREV_WEEK || '2026-W08'
  await setDoc(doc(db, 'settings', 'meta'), { lastAutoProcessedWeekId: prevWeek }, { merge: true })
  console.log(`   settings/meta: lastAutoProcessedWeekId = ${prevWeek}`)

  console.log(`\n✅  Reset complete. Ready for week ${CURRENT_WEEK}.\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌  Reset failed:', err)
  process.exit(1)
})

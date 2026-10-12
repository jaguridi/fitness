// Read-only diagnosis of week 2026-W41 (5–11 Oct) for the agreed amnesty.
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { simulateAutoRecovery, getAbsenceRecoveryWindow, isAbsenceRecoverySuspended } from '../../src/game/absences.js'

const WEEK = process.argv[2] || '2026-W41'
const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI', authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e', storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}))
const cols = ['users', 'absences', 'workouts', 'weekly_summaries', 'justifications']
const data = Object.fromEntries(await Promise.all(cols.map(async (c) =>
  [c, (await getDocs(collection(db, c))).docs.map((d) => ({ id: d.id, ...d.data() }))]
)))
const sessions = {}
for (const w of data.workouts) {
  (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
}
const sim = simulateAutoRecovery(data.absences, sessions)
const gameFields = ['id', 'name', 'walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const ts = (v) => (v?.toDate ? v.toDate().toISOString() : v)
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ts(v)]))
console.log(JSON.stringify({
  meta: clean((await getDoc(doc(db, 'settings', 'meta'))).data()),
  users: data.users.map((u) => Object.fromEntries(gameFields.map((k) => [k, u[k]]))),
  summaries: data.weekly_summaries.filter((s) => s.weekId >= '2026-W39').map(clean)
    .sort((a, b) => a.weekId.localeCompare(b.weekId) || a.userId.localeCompare(b.userId)),
  justifications: data.justifications.filter((j) => j.weekId >= '2026-W40').map(clean),
  absences: data.absences.filter((a) => a.status !== 'closed' || (a.frozenWeeks && Object.keys(a.frozenWeeks).some((w) => w >= '2026-W39'))).map((a) => ({
    ...clean(a), window: getAbsenceRecoveryWindow(a, data.absences), suspended: isAbsenceRecoverySuspended(a, data.absences),
    remaining: sim.remainingDebtByAbsence[a.id], consumed: sim.debtConsumedPerAbsenceWeek[a.id],
  })),
  weekWorkouts: data.workouts.filter((w) => w.weekId >= WEEK).map((w) => ({
    id: w.id, userId: w.userId, weekId: w.weekId, date: w.date, duration: w.duration, exerciseType: w.exerciseType,
  })),
  recap: clean((await getDoc(doc(db, 'weekly_recaps', WEEK))).data() || {}),
  monthlyOct: (await getDoc(doc(db, 'monthly_recaps', '2026-10'))).exists(),
}, null, 2))
process.exit(0)

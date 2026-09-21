// Read-only diagnosis for the agreed 14–20 September 2026 holiday.
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { simulateAutoRecovery, getAbsenceRecoveryWindow } from '../../src/game/absences.js'

const db = getFirestore(initializeApp({ projectId: 'family-fitness-3494e' }))
const cols = ['users', 'absences', 'workouts', 'weekly_summaries']
const data = Object.fromEntries(await Promise.all(cols.map(async (c) =>
  [c, (await getDocs(collection(db, c))).docs.map((d) => ({ id: d.id, ...d.data() }))]
)))
const sessions = {}
for (const w of data.workouts) {
  (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
}
const sim = simulateAutoRecovery(data.absences, sessions)
const gameFields = ['id', 'name', 'walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
console.log(JSON.stringify({
  users: data.users.map((u) => Object.fromEntries(gameFields.map((k) => [k, u[k]]))),
  recentSummaries: data.weekly_summaries.filter((s) => s.weekId >= '2026-W34'),
  activeAbsences: data.absences.filter((a) => a.status !== 'closed').map((a) => ({
    ...a, window: getAbsenceRecoveryWindow(a, data.absences),
    remaining: sim.remainingDebtByAbsence[a.id], consumed: sim.debtConsumedPerAbsenceWeek[a.id],
  })),
  holidayWorkouts: data.workouts.filter((w) => w.weekId === '2026-W38').map((w) => ({
    id: w.id, userId: w.userId, weekId: w.weekId, date: w.date, duration: w.duration, exerciseType: w.exerciseType,
  })),
  recap: (await getDoc(doc(db, 'weekly_recaps', '2026-W38'))).data(),
}, null, 2))
process.exit(0)

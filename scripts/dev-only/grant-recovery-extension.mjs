// One-off: grant N extra ACTIVE recovery weeks to every ACTIVE new-format absence.
//
// Extraordinary measure (2026-07-30) after the confusion over how recovery debt
// was being counted. Writes `extraRecoveryWeeks` on the doc; the standing ±4
// rule is untouched for every future absence.
//
// Dry-run:  node scripts/dev-only/grant-recovery-extension.mjs
// Apply:    node scripts/dev-only/grant-recovery-extension.mjs --apply
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { getAbsenceRecoveryWindow, isLegacyAbsence, simulateAutoRecovery } from '../../src/game/absences.js'
import { WEEKLY_GOAL, BASE_FINE, MAX_FINE } from '../../src/game/constants.js'

const WEEKS = 2
const CUR = '2026-W31'
const APPLY = process.argv.includes('--apply')

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com', projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}
const db = getFirestore(initializeApp(firebaseConfig))
const NAMES = { user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' }

const [absSnap, woSnap, usersSnap] = await Promise.all([
  getDocs(collection(db, 'absences')), getDocs(collection(db, 'workouts')), getDocs(collection(db, 'users')),
])
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const users = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
const sessions = {}
for (const d of woSnap.docs) { const w = d.data(); (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1 }

// Targets: ACTIVE, new-format. Closed ones are already settled (fines charged);
// extending them would only let them re-claim extras away from live debts.
const targets = absences.filter((a) => !isLegacyAbsence(a) && a.frozenWeeks && a.status !== 'closed')
const skipped = absences.filter((a) => !targets.includes(a))

const before = simulateAutoRecovery(absences, sessions)
const after = simulateAutoRecovery(
  absences.map((a) => (targets.includes(a) ? { ...a, extraRecoveryWeeks: (a.extraRecoveryWeeks || 0) + WEEKS } : a)),
  sessions
)
const patched = absences.map((a) => (targets.includes(a) ? { ...a, extraRecoveryWeeks: (a.extraRecoveryWeeks || 0) + WEEKS } : a))

const fineFor = (uid, remaining) => {
  const lvl = users[uid]?.currentFineLevel || BASE_FINE
  return Math.min(MAX_FINE, Math.round((lvl * remaining) / WEEKLY_GOAL))
}

console.log(`${APPLY ? '‼️  APPLYING' : '🔎 DRY-RUN'} — +${WEEKS} active recovery weeks, ${targets.length} absences\n`)
let finesAvoided = 0
for (const a of targets) {
  const oldWin = getAbsenceRecoveryWindow(a, absences)
  const newWin = getAbsenceRecoveryWindow(patched.find((p) => p.id === a.id), patched)
  const oldEnd = oldWin[oldWin.length - 1], newEnd = newWin[newWin.length - 1]
  const rem = before.remainingDebtByAbsence[a.id] || 0
  const settlingNow = oldEnd === CUR && rem > 0
  if (settlingNow) finesAvoided += fineFor(a.userId, rem)
  console.log(`  ${NAMES[a.userId].padEnd(6)} ${a.id.slice(0, 6)} ${JSON.stringify(a.frozenWeeks)}`)
  console.log(`         plazo ${oldEnd} → ${newEnd}   deuda pendiente ${rem}` +
    (settlingNow ? `   ⏰ evita multa de $${fineFor(a.userId, rem).toLocaleString('es-CL')} este domingo` : ''))
}

console.log('\n  NO tocadas:')
for (const a of skipped) {
  const why = isLegacyAbsence(a) ? 'formato legacy (no usa ventanas ni deuda)' : 'cerrada — ya liquidada'
  console.log(`  ${NAMES[a.userId].padEnd(6)} ${a.id.slice(0, 6)} — ${why}`)
}

console.log('\n  Deuda pendiente por persona (no cambia — solo cambia el plazo):')
for (const uid of ['user1', 'user2', 'user3', 'user4']) {
  const sum = (sim) => absences.filter((a) => a.userId === uid && !isLegacyAbsence(a) && a.status !== 'closed')
    .reduce((s, a) => s + (sim.remainingDebtByAbsence[a.id] || 0), 0)
  console.log(`  ${NAMES[uid].padEnd(6)} antes=${sum(before)}  después=${sum(after)}`)
}
console.log(`\n  Multas evitadas este domingo: $${finesAvoided.toLocaleString('es-CL')}`)

if (!APPLY) {
  console.log('\n(dry-run: no se escribió nada. Repite con --apply)')
  process.exit(0)
}

for (const a of targets) {
  await updateDoc(doc(db, 'absences', a.id), {
    extraRecoveryWeeks: (a.extraRecoveryWeeks || 0) + WEEKS,
    extensionReason: `Prórroga extraordinaria de ${WEEKS} semanas (2026-07-30) por la confusión en el conteo de la deuda de recuperación.`,
  })
  console.log(`  ✅ ${NAMES[a.userId]} ${a.id}`)
}
console.log('\nListo. Falta: firebase deploy --only functions')
process.exit(0)

// Grant N extra ACTIVE recovery weeks to specific active new-format absences.
//
// Writes/increments `extraRecoveryWeeks` on the absence doc (read by both the
// client and the deployed weeklyClose, no deploy needed); the standing ±4 rule
// is untouched for every other absence.
//
// Usage (dry-run by default; add --apply to write):
//   node scripts/dev-only/grant-recovery-extension.mjs --weeks 2 \
//     --ids wPUvg3zsXIpD0eqYHoTD,yY8ooM8Q7MAzy7aNeeHg \
//     --reason "Prórroga de 2 semanas (2026-09-11) ..." [--apply]
//   --all   instead of --ids: every ACTIVE new-format absence (what the 2026-07-30 grant did)
//
// History: 2026-07-30 +2 to all active absences (recovery-count confusion);
//          2026-09-11 +2 to Jose's and Javi's W29/W30 absences (deadline landed on
//          Javi's medical rest week; Jose's on a 1-session week).
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { getAbsenceRecoveryWindow, isLegacyAbsence, simulateAutoRecovery } from '../../src/game/absences.js'
import { getWeekId } from '../../src/game/weekId.js'
import { WEEKLY_GOAL, BASE_FINE, MAX_FINE } from '../../src/game/constants.js'

const args = process.argv.slice(2)
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback
}
const APPLY = args.includes('--apply')
const ALL = args.includes('--all')
const WEEKS = Number(opt('weeks', 2))
const IDS = (opt('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const REASON = opt('reason')
const CUR = getWeekId()
const NAMES = { user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' }

if (!Number.isInteger(WEEKS) || WEEKS < 1 || !REASON || (!ALL && IDS.length === 0)) {
  console.error('Uso: --weeks N (--ids id1,id2 | --all) --reason "..." [--apply]')
  process.exit(1)
}

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI', authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e', storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}))

const [absSnap, woSnap, usersSnap] = await Promise.all([
  getDocs(collection(db, 'absences')), getDocs(collection(db, 'workouts')), getDocs(collection(db, 'users')),
])
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const users = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
const sessions = {}
for (const d of woSnap.docs) {
  const w = d.data()
  ;(sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
}

const active = absences.filter((a) => !isLegacyAbsence(a) && a.frozenWeeks && a.status !== 'closed')
const targets = ALL ? active : IDS.map((id) => absences.find((a) => a.id === id)).filter(Boolean)
const missing = ALL ? [] : IDS.filter((id) => !absences.some((a) => a.id === id))
if (missing.length) { console.error(`No existen: ${missing.join(', ')}`); process.exit(1) }
const notActive = targets.filter((a) => !active.includes(a))
if (notActive.length) {
  console.error(`No se prorrogan ausencias cerradas o legacy: ${notActive.map((a) => a.id).join(', ')}`)
  process.exit(1)
}

const patched = absences.map((a) => (targets.includes(a) ? { ...a, extraRecoveryWeeks: (a.extraRecoveryWeeks || 0) + WEEKS } : a))
const before = simulateAutoRecovery(absences, sessions)
const after = simulateAutoRecovery(patched, sessions)
const fineFor = (uid, remaining) => {
  const lvl = users[uid]?.currentFineLevel || BASE_FINE
  return Math.min(MAX_FINE, Math.round((lvl * remaining) / WEEKLY_GOAL))
}

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — +${WEEKS} semana(s) activa(s) de recuperación, ${targets.length} ausencia(s). Semana actual ${CUR}\n`)
let finesAvoided = 0
for (const a of targets) {
  const oldWin = getAbsenceRecoveryWindow(a, absences)
  const newWin = getAbsenceRecoveryWindow(patched.find((p) => p.id === a.id), patched)
  const oldEnd = oldWin[oldWin.length - 1], newEnd = newWin[newWin.length - 1]
  const rem = before.remainingDebtByAbsence[a.id] || 0
  const settlingNow = oldEnd === CUR && rem > 0
  if (settlingNow) finesAvoided += fineFor(a.userId, rem)
  console.log(`  ${NAMES[a.userId].padEnd(6)} ${a.id} ${JSON.stringify(a.frozenWeeks)}`)
  console.log(`         prórroga ${a.extraRecoveryWeeks || 0} → ${(a.extraRecoveryWeeks || 0) + WEEKS}   plazo ${oldEnd} → ${newEnd}   deuda pendiente ${rem}` +
    (settlingNow ? `   evita este lunes una multa de $${fineFor(a.userId, rem).toLocaleString('es-CL')}` : ''))
}
console.log(`\n  Multas evitadas en el próximo cierre: $${finesAvoided.toLocaleString('es-CL')}`)
console.log('  Deuda pendiente por persona (no cambia — solo cambia el plazo):')
for (const uid of Object.keys(NAMES)) {
  const sum = (sim) => active.filter((a) => a.userId === uid).reduce((s, a) => s + (sim.remainingDebtByAbsence[a.id] || 0), 0)
  console.log(`    ${NAMES[uid].padEnd(6)} antes=${sum(before)}  después=${sum(after)}`)
}

if (!APPLY) { console.log('\n(dry-run: no se escribió nada. Repite con --apply)'); process.exit(0) }

for (const a of targets) {
  await updateDoc(doc(db, 'absences', a.id), {
    extraRecoveryWeeks: (a.extraRecoveryWeeks || 0) + WEEKS,
    extensionReason: `${a.extensionReason ? `${a.extensionReason} | ` : ''}${REASON}`,
  })
  console.log(`  OK ${NAMES[a.userId]} ${a.id}`)
}
console.log('\nListo.')
process.exit(0)

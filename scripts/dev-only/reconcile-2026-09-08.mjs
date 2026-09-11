// One-off (2026-09-08): reconcile the ledger after the v1.8.0 recovery rule and
// grant José's W36 justification administratively.
//
// What it does (each step guarded by the exact state diagnosed on 2026-09-07):
//   A. justifications: José's W36 doc → admin-granted, 2 sessions (keeps the
//      AI verdict text in previousAiReason for transparency).
//   B. José W36 close re-derived as 'justified': wallet −5000, fine level back
//      to 5000, consecutiveMisses back to 0, summary → justified.
//   C. Gonza's W29 settlement under the NEW rule (extras above the week's real
//      requirement): his 4th session in W35 (1 frozen) is 2 extras, so the
//      W29 debt left was 1, not 2 → fine 1667 instead of 3333. Wallet −1666;
//      absence + W29/W35 summaries patched.
//   D. José/Javi W25 summaries: restore status 'missed' + settlement fine that
//      the 2026-09-07 rewind overwrote (history only — wallets already hold it).
//   E. (--fix-jose-surplus only) José's wallet holds $2,500 more than every
//      fine on record; no document explains it. NOT applied by default.
//
// Dry-run:  node scripts/dev-only/reconcile-2026-09-08.mjs
// Apply:    node scripts/dev-only/reconcile-2026-09-08.mjs --apply [--fix-jose-surplus]
import { writeFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { simulateAutoRecovery } from '../../src/game/absences.js'
import { WEEKLY_GOAL, BASE_FINE, MAX_FINE } from '../../src/game/constants.js'

const APPLY = process.argv.includes('--apply')
const FIX_SURPLUS = process.argv.includes('--fix-jose-surplus')
const TODAY = '2026-09-08'
const clp = (n) => `$${Number(n).toLocaleString('es-CL')}`

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI', authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e', storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}))

const [usersSnap, woSnap, absSnap, sumSnap, jusSnap] = await Promise.all([
  getDocs(collection(db, 'users')), getDocs(collection(db, 'workouts')), getDocs(collection(db, 'absences')),
  getDocs(collection(db, 'weekly_summaries')), getDocs(collection(db, 'justifications')),
])
const users = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const summaries = Object.fromEntries(sumSnap.docs.map((d) => [d.id, d.data()]))
const justifications = jusSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const sessions = {}
for (const d of woSnap.docs) {
  const w = d.data()
  ;(sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
}

const writes = []   // { path, patch, why }
const backup = {}   // path → current doc (only the docs we touch)
const problems = []
const plan = (path, current, patch, why) => { writes.push({ path, patch, why }); backup[path] = current }
const expect = (cond, msg) => { if (!cond) problems.push(msg) }

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — reconciliación ${TODAY}\n`)

// ── A + B. José W36 ─────────────────────────────────────────────────────────
{
  const jus = justifications.filter((j) => j.userId === 'user1' && j.weekId === '2026-W36')
  expect(jus.length === 1, `Jose W36: esperaba 1 justificación, hay ${jus.length}`)
  const j = jus[0]
  const u = users.user1
  const s = summaries['user1_2026-W36']
  if (j && u && s) {
    expect(j.aiVerdict === false && j.grantedBy == null, `Jose W36 justificación ya no está rechazada (aiVerdict=${j.aiVerdict}, grantedBy=${j.grantedBy})`)
    expect(s.status === 'missed' && s.fineApplied === 5000 && s.sessions === 1 && s.deficit === 2, `Jose W36 summary inesperado: ${JSON.stringify(s)}`)
    expect(u.currentFineLevel === 10000 && u.consecutiveMisses === 1 && u.walletBalance === 25833, `Jose user inesperado: lvl=${u.currentFineLevel} misses=${u.consecutiveMisses} wallet=${u.walletBalance}`)

    const GRANT = `Concedida administrativamente por José el ${TODAY}: gripe de 4 días (jueves a domingo) y gimnasio cerrado el lunes, en una semana en que entrena habitualmente lunes a miércoles. El Juez IA la había rechazado con el criterio antiguo ("el cierre del gimnasio no impide entrenar por otra vía"), reemplazado en v1.8.0 por el modelo realista de días habituales. NO pasó por el Juez IA nuevo.`
    plan(`justifications/${j.id}`, j, {
      aiVerdict: true, status: 'resolved', sessionsJustified: 2, sessionsRequested: 2,
      grantedBy: 'admin', grantedAt: TODAY, previousAiReason: j.aiReason, aiReason: GRANT,
    }, 'Jose W36: justificación administrativa (2 sesiones)')

    // Re-derive the close with the justification: deficit 2, justified 2 → no fine,
    // fine level and misses exactly as they were before the W36 close.
    plan('weekly_summaries/user1_2026-W36', s, {
      status: 'justified', fineApplied: 0, sessionsJustified: 2, effectiveDeficit: 0,
      correctionNote: `Recalculada el ${TODAY} tras justificación administrativa (antes: multada ${clp(5000)}).`,
    }, 'Jose W36 summary → justified')
    plan('users/user1', u, {
      walletBalance: u.walletBalance - 5000, currentFineLevel: 5000, consecutiveMisses: 0,
    }, `Jose: revertir multa W36 (−${clp(5000)}), nivel 10000→5000, fallos 1→0`)
  }
}

// ── C. Gonza W29 settlement under the new rule ──────────────────────────────
{
  const ABS = 'scloZMdLvzSM2ICK40nt'
  const a = absences.find((x) => x.id === ABS)
  const u = users.user3
  const s29 = summaries['user3_2026-W29']
  const s35 = summaries['user3_2026-W35']
  const sim = simulateAutoRecovery(absences, sessions)
  const remaining = sim.remainingDebtByAbsence[ABS]
  const w35Consumed = sim.debtConsumedByUserWeek.user3?.['2026-W35'] || 0
  expect(a && a.status === 'closed' && a.debtUnpaid === 2 && a.fineApplied === 3333, `Gonza absence inesperada: ${JSON.stringify(a)}`)
  expect(remaining === 1, `Gonza: la regla nueva dice deuda restante ${remaining}, esperaba 1`)
  expect(w35Consumed === 2, `Gonza: la regla nueva dice W35 pagó ${w35Consumed}, esperaba 2`)
  expect(s29 && s29.fineApplied === 3333 && s29.debtUnpaid === 2, `Gonza W29 summary inesperado: ${JSON.stringify(s29)}`)
  expect(s35 && s35.debtConsumed === 1 && s35.sessions === 4, `Gonza W35 summary inesperado: ${JSON.stringify(s35)}`)
  expect(u && u.walletBalance === 5833, `Gonza wallet inesperado: ${u?.walletBalance}`)
  if (a && u && s29 && s35 && remaining === 1) {
    // Settlement priced at the level carried INTO the W36 close (5000), as the close did.
    const fine = Math.min(MAX_FINE, Math.round((BASE_FINE * remaining) / WEEKLY_GOAL)) // 1667
    const delta = a.fineApplied - fine // 1666
    plan(`absences/${ABS}`, a, {
      debtUnpaid: remaining, fineApplied: fine,
      correctionNote: `Recalculado el ${TODAY} con la regla v1.8.0 (extras sobre lo exigible de la semana): la 4ª sesión de la W35 con 1 congelada vale 2 extras. Antes: deuda 2, multa ${clp(3333)}.`,
    }, `Gonza absence W29: deuda 2→${remaining}, multa 3333→${fine}`)
    plan('weekly_summaries/user3_2026-W29', s29, { fineApplied: fine, debtUnpaid: remaining }, `Gonza W29 summary: multa 3333→${fine}`)
    plan('weekly_summaries/user3_2026-W35', s35, { debtConsumed: 2 }, 'Gonza W35 summary: debtConsumed 1→2')
    plan('users/user3', u, { walletBalance: u.walletBalance - delta }, `Gonza: devolver ${clp(delta)}`)
  }
}

// ── D. W25 settlement history (Jose 3333, Javi 1667) ────────────────────────
for (const [uid, fine, absId] of [['user1', 3333, 'v3pBmTRlz7ddA2oPnL3O'], ['user2', 1667, 'RH2kTlOxMbkjqx7JkxaC']]) {
  const s = summaries[`${uid}_2026-W25`]
  const a = absences.find((x) => x.id === absId)
  expect(s && s.status === 'frozen' && (s.fineApplied || 0) === 0 && s.debtUnpaid === a?.debtUnpaid, `${uid} W25 summary inesperado: ${JSON.stringify(s)}`)
  expect(a && a.status === 'closed' && a.fineApplied === fine, `${uid} absence W25 inesperada: ${JSON.stringify(a)}`)
  if (s && a) {
    const closedDay = typeof a.closedAt === 'string' ? a.closedAt.slice(0, 10) : '2026-08-17'
    plan(`weekly_summaries/${uid}_2026-W25`, s, {
      status: 'missed', fineApplied: fine,
      correctionNote: `Restaurado el ${TODAY}: la liquidación del ${closedDay} (multa ${clp(fine)}) había sido sobreescrita por el reprocesamiento del 2026-09-07. Solo historial: la billetera ya la incluía.`,
    }, `${uid} W25 summary → missed(${clp(fine)}) (solo historial)`)
  }
}

// ── E. José's unexplained surplus (opt-in) ──────────────────────────────────
{
  const u = users.user1
  const onRecord = Object.values(summaries)
    .filter((s) => s.userId === 'user1')
    .reduce((t, s) => t + (s.fineApplied || 0), 0)
    + 3333 /* W25 settlement, restored in D */
    - 5000 /* W36 reverted in B */
  const walletAfter = u.walletBalance - 5000
  const surplus = walletAfter - onRecord
  console.log(`  Jose: tras A–D la billetera queda en ${clp(walletAfter)} y las multas registradas suman ${clp(onRecord)} → excedente sin respaldo: ${clp(surplus)}`)
  if (FIX_SURPLUS && surplus > 0) {
    const prev = writes.find((w) => w.path === 'users/user1')
    prev.patch.walletBalance -= surplus
    prev.why += ` y quitar excedente sin respaldo −${clp(surplus)}`
  } else if (surplus > 0) {
    console.log('  (no se toca; repite con --fix-jose-surplus para descontarlo)\n')
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const w of writes) {
  console.log(`  → ${w.path}`)
  console.log(`      ${w.why}`)
  console.log(`      ${JSON.stringify(w.patch)}`)
}
if (problems.length) {
  console.log('\nEl estado actual NO coincide con lo diagnosticado. No se escribe nada:')
  for (const p of problems) console.log('   - ' + p)
  process.exit(1)
}
if (!APPLY) {
  console.log('\n(dry-run: no se escribió nada. Repite con --apply)')
  process.exit(0)
}

const backupPath = `scripts/dev-only/backups/${TODAY}-reconcile-before.json`
writeFileSync(backupPath, JSON.stringify(backup, null, 2))
console.log(`\nRespaldo de los ${Object.keys(backup).length} docs previos: ${backupPath}`)
for (const w of writes) {
  const [col, id] = w.path.split('/')
  await updateDoc(doc(db, col, id), { ...w.patch, updatedAt: serverTimestamp() })
  console.log(`  OK ${w.path}`)
}
console.log('\nListo.')
process.exit(0)

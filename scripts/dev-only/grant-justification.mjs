// One-off: record ADMIN-GRANTED justifications for the current week.
//
// These bypass the AI judge on purpose, so the doc says so: aiVerdict is true
// (that's what computeSessionsJustified reads) but aiReason and grantedBy make
// the provenance unmistakable — nobody should later read these as a judge ruling.
//
// Dry-run:  node scripts/dev-only/grant-justification.mjs
// Apply:    node scripts/dev-only/grant-justification.mjs --apply
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { computeWeekRequirements, computeSessionsJustified } from '../../src/game/absences.js'

const WEEK = '2026-W32'
const APPLY = process.argv.includes('--apply')
const GRANT_NOTE = 'Concedida administrativamente por José el 2026-08-07 (gimnasio cerrado 2 días esta semana + una noche sin dormir por el insomnio de Josecito). NO pasó por el Juez IA.'

const GRANTS = [
  {
    userId: 'user2', name: 'Javi', sessionsJustified: 1,
    excuse: 'El gimnasio estuvo cerrado dos días esta semana.',
  },
  {
    userId: 'user1', name: 'Jose', sessionsJustified: 2,
    excuse: 'El gimnasio estuvo cerrado dos días esta semana y además pasé una noche sin dormir por el insomnio de Josecito.',
  },
]

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com', projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}
const db = getFirestore(initializeApp(firebaseConfig))

const [woSnap, absSnap, jusSnap] = await Promise.all([
  getDocs(collection(db, 'workouts')), getDocs(collection(db, 'absences')),
  getDocs(query(collection(db, 'justifications'), where('weekId', '==', WEEK))),
])
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const existing = jusSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const sessions = {}
for (const d of woSnap.docs) { const w = d.data(); (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1 }

console.log(`${APPLY ? '‼️  APLICANDO' : '🔎 DRY-RUN'} — justificaciones administrativas para ${WEEK}\n`)

let blocked = false
for (const g of GRANTS) {
  const req = computeWeekRequirements(g.userId, WEEK, absences).totalRequired
  const done = sessions[g.userId]?.[WEEK] || 0
  const deficit = Math.max(0, req - done)
  const already = computeSessionsJustified(g.userId, WEEK, existing)
  const dup = existing.filter((j) => j.userId === g.userId)

  console.log(`  ${g.name}: exigibles=${req} hechas=${done} → déficit=${deficit}`)
  console.log(`     a justificar: ${g.sessionsJustified}  (ya registradas: ${already})`)
  if (dup.length) { console.log(`     ⚠️  YA EXISTE una justificación de ${g.name} en ${WEEK} — no se duplica.`); blocked = true; continue }
  if (g.sessionsJustified > deficit) console.log(`     ⚠️  justifica MÁS que el déficit; el excedente no hace nada.`)
  console.log(`     resultado: déficit efectivo ${Math.max(0, deficit - g.sessionsJustified)} → ${deficit - g.sessionsJustified <= 0 ? 'SIN multa' : 'AÚN con multa'}`)
  console.log(`     "${g.excuse}"\n`)
}

if (!APPLY) { console.log('(dry-run: no se escribió nada. Repite con --apply)'); process.exit(0) }
if (blocked) { console.log('❌ Abortado: hay duplicados. Revisa antes de reintentar.'); process.exit(1) }

for (const g of GRANTS) {
  await addDoc(collection(db, 'justifications'), {
    userId: g.userId,
    weekId: WEEK,
    excuse: g.excuse,
    sessionsJustified: g.sessionsJustified,
    evidencePhotoURL: null,
    aiVerdict: true,
    aiReason: GRANT_NOTE,
    status: 'resolved',
    appealCount: 0,
    grantedBy: 'admin',
    createdAt: serverTimestamp(),
  })
  console.log(`  ✅ ${g.name}: ${g.sessionsJustified} sesión(es)`)
}
process.exit(0)

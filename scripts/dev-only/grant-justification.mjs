// Record an ADMIN-GRANTED justification for a user/week (bypasses the AI judge).
//
// The doc says so on purpose: aiVerdict is true (that's what computeSessionsJustified
// reads) but aiReason and grantedBy make the provenance unmistakable — nobody should
// later read these as a judge ruling.
//
// Usage (dry-run by default; add --apply to write):
//   node scripts/dev-only/grant-justification.mjs \
//     --user user2 --week 2026-W37 --sessions 3 \
//     --excuse "Semana de descanso por migrañas persistentes." \
//     --note "Concedida administrativamente por José el 2026-09-11 ..." [--apply]
//
// If the user already has a justification for that week, it is UPDATED (never
// duplicated); the previous verdict is kept in previousAiReason.
//
// History: 2026-08-07 (W32) José 2 ses. + Javi 1 ses., gimnasio cerrado 2 días;
//          2026-09-11 (W37) Javi 3 ses., semana de descanso por migrañas.
import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where,
} from 'firebase/firestore'
import { computeWeekRequirements, computeSessionsJustified } from '../../src/game/absences.js'
import { getWeekId } from '../../src/game/weekId.js'
import { WEEKLY_GOAL } from '../../src/game/constants.js'

const args = process.argv.slice(2)
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback
}
const APPLY = args.includes('--apply')
const USER = opt('user')
const WEEK = opt('week', getWeekId())
const SESSIONS = Number(opt('sessions', WEEKLY_GOAL))
const EXCUSE = opt('excuse')
const NOTE = opt('note')
const NAMES = { user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' }

if (!USER || !NAMES[USER] || !EXCUSE || !NOTE || !Number.isInteger(SESSIONS) || SESSIONS < 1 || SESSIONS > WEEKLY_GOAL) {
  console.error('Uso: --user user1..4 --week YYYY-Www --sessions 1..3 --excuse "..." --note "..." [--apply]')
  process.exit(1)
}

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI', authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e', storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}))

const [woSnap, absSnap, jusSnap] = await Promise.all([
  getDocs(query(collection(db, 'workouts'), where('userId', '==', USER), where('weekId', '==', WEEK))),
  getDocs(collection(db, 'absences')),
  getDocs(query(collection(db, 'justifications'), where('weekId', '==', WEEK), where('userId', '==', USER))),
])
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const existing = jusSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const done = woSnap.size
const dates = woSnap.docs.map((d) => d.data().date).filter(Boolean).sort()

const req = computeWeekRequirements(USER, WEEK, absences)
const deficit = Math.max(0, req.totalRequired - done)
const already = computeSessionsJustified(USER, WEEK, existing)

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — justificación administrativa ${NAMES[USER]} ${WEEK}\n`)
console.log(`  exigibles=${req.totalRequired}${req.frozenSessions ? ` (congeladas ${req.frozenSessions})` : ''}  hechas=${done}${dates.length ? ` (${dates.join(', ')})` : ''}  → déficit=${deficit}`)
console.log(`  a justificar: ${SESSIONS}  (ya justificadas: ${already})`)
if (SESSIONS > deficit) console.log(`  nota: justifica más que el déficit actual; el excedente no hace nada.`)
console.log(`  resultado al cierre: déficit efectivo ${Math.max(0, deficit - SESSIONS)} → ${deficit - SESSIONS <= 0 ? 'SIN multa' : 'AÚN con multa'}`)
console.log(`  "${EXCUSE}"\n`)

const data = {
  excuse: EXCUSE,
  sessionsJustified: SESSIONS,
  sessionsRequested: SESSIONS,
  evidencePhotoURL: null,
  aiVerdict: true,
  aiReason: NOTE,
  status: 'resolved',
  grantedBy: 'admin',
  grantedAt: new Date().toISOString().slice(0, 10),
}

if (existing.length > 1) {
  console.log(`  ERROR: hay ${existing.length} justificaciones de ${NAMES[USER]} en ${WEEK}. Revisa a mano.`)
  process.exit(1)
}
if (existing.length === 1) {
  const j = existing[0]
  console.log(`  Ya existe una justificación (${j.id}): verdict=${j.aiVerdict} status=${j.status} ses=${j.sessionsJustified} granted=${j.grantedBy || '-'}`)
  console.log(`  → se ACTUALIZA (se conserva el veredicto anterior en previousAiReason)`)
  if (!APPLY) { console.log('\n(dry-run: no se escribió nada. Repite con --apply)'); process.exit(0) }
  await updateDoc(doc(db, 'justifications', j.id), {
    ...data, previousAiReason: j.aiReason || null, updatedAt: serverTimestamp(),
  })
  console.log(`\n  OK actualizada ${j.id}`)
  process.exit(0)
}

console.log('  → se CREA una justificación nueva')
if (!APPLY) { console.log('\n(dry-run: no se escribió nada. Repite con --apply)'); process.exit(0) }
const ref = await addDoc(collection(db, 'justifications'), {
  userId: USER, weekId: WEEK, ...data, appealCount: 0, createdAt: serverTimestamp(),
})
console.log(`\n  OK creada ${ref.id}`)
process.exit(0)

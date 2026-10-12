// One-off correction requested by José on 2026-10-05 for week 2026-W40
// (28 Sep – 4 Oct), already closed with a $5.000 fine for Jose (1 of 3):
//   - Jose: admin justification of the 2 missing sessions. Javi still had side
//     effects (insomnia) from her migraine treatment, which made getting back
//     into the routine hard. Fine reverted, fine level and miss count restored.
//   - Gonza and Fran keep their W40 fines; Javi stays paused (PARTICIPATION_PAUSES).
//   - The W40 recap and the September monthly recap (W40 starts on 28 Sep)
//     are rewritten so they no longer report Jose's fine.
// Dry-run by default; --apply writes everything in ONE transaction, after
// saving a backup to scripts/dev-only/backups/. Uses the Firebase CLI login;
// never prints or stores credentials.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { computeWeekEndOutcome } from '../../src/game/weekEnd.js'

const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url))
const { Firestore, FieldValue } = requireFunctions('@google-cloud/firestore')
const { OAuth2Client } = requireFunctions('google-auth-library')
const cliRoot = process.env.FIREBASE_TOOLS_ROOT || join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'firebase-tools')
const requireCli = createRequire(join(cliRoot, 'package.json'))
const { getAccessToken } = requireCli('./lib/auth.js')
const { configstore } = requireCli('./lib/configstore.js')
const refreshToken = configstore.get('tokens')?.refresh_token
assert(refreshToken, 'Firebase CLI login is required.')
const token = await getAccessToken(refreshToken, [])
const authClient = new OAuth2Client()
authClient.setCredentials({ access_token: token.access_token,
  expiry_date: Date.now() + (token.expires_in || 3600) * 1000 })
const db = new Firestore({ projectId: 'family-fitness-3494e', authClient })

const APPLY = process.argv.includes('--apply')
const WEEK = '2026-W40'
const USER = 'user1'
const CORRECTION = 'w40-jose-justificada-2026'
const TODAY = '2026-10-05'
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))

// Jose's state after the W39 correction (its expected result), i.e. what the
// W40 close started from. Nothing touched users between the two.
const preW40 = { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 }
// What the ordinary W40 close (2026-10-05 00:10) wrote for Jose.
const closedW40 = {
  user: { walletBalance: 25833, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
  summary: { status: 'missed', sessions: 1, totalRequired: 3, deficit: 2, fineApplied: 5000, sessionsJustified: 0, shieldBroken: false, debtConsumed: 0 },
}
// Expected result of re-closing W40 for Jose with 2 justified sessions.
const expected = {
  summary: { status: 'justified', sessions: 1, totalRequired: 3, deficit: 2, sessionsJustified: 2, effectiveDeficit: 0, fineApplied: 0, debtConsumed: 0, extrasBanked: 0 },
  user: preW40,
}
const justification = {
  userId: USER, weekId: WEEK,
  excuse: 'Javi todavía tuvo efectos secundarios (insomnio) de su tratamiento para la migraña, y retomar la rutina ha sido complejo.',
  aiReason: `Concedida administrativamente por José el ${TODAY}: Javi siguió con efectos secundarios (insomnio) del tratamiento para su migraña y a Jose le costó retomar; hizo 1 de 3 sesiones y se justifican las 2 que faltaron. NO pasó por el Juez IA.`,
  sessionsJustified: 2, sessionsRequested: 2, evidencePhotoURL: null,
  aiVerdict: true, status: 'resolved', grantedBy: 'admin', grantedAt: TODAY, appealCount: 0,
}
const note = 'Semana justificada administrativamente (2 sesiones): Javi siguió con efectos secundarios de su tratamiento y retomar ha sido complejo. Multa de $5.000 revertida.'
const recapText = [
  'Semana 40: Jose alcanzó a sacar 1 sesión y las otras 2 quedaron justificadas, porque la recuperación de Javi ha seguido siendo compleja: sin multa para él. 💙',
  'Gonza quedó en modo banca y Fran dejó las sesiones en visto: el entrenamiento preguntó por ustedes y nadie contestó.',
  'Javi sigue en pausa; te mandamos mucho ánimo y te esperamos con cariño. 🌱',
  'El VAR de las multas cobró $5.000 a Gonza y $5.000 a Fran: tremendo aporte al fondo común, pero la próxima a entrenar antes de financiarlo 💸😅',
].join('\n')
// The September monthly recap was generated after the W40 close and counts it.
const monthlyOld = 'En la tabla de pendientes quedaron Jose, Gonza y Fran con una semana fallida cada uno, armando un cobro de tarjetas amarillas por $15.000 en multas, ¡más caro que el VAR!'
const monthlyNew = 'En la tabla de pendientes quedaron Gonza y Fran con una semana fallida cada uno, armando un cobro de tarjetas amarillas por $10.000 en multas, ¡más caro que el VAR!'

const result = await db.runTransaction(async (tx) => {
  const [usersSnap, absSnap, woSnap, sumSnap, justSnap] = await Promise.all([
    tx.get(db.collection('users')),
    tx.get(db.collection('absences')),
    tx.get(db.collection('workouts')),
    tx.get(db.collection('weekly_summaries').where('weekId', '==', WEEK)),
    tx.get(db.collection('justifications').where('weekId', '==', WEEK)),
  ])
  const meta = await tx.get(db.doc('settings/meta'))
  const recap = await tx.get(db.doc(`weekly_recaps/${WEEK}`))
  const monthly = await tx.get(db.doc('monthly_recaps/2026-09'))

  const jose = usersSnap.docs.find((d) => d.id === USER)
  const summary = sumSnap.docs.find((d) => d.data().userId === USER)
  assert(jose && summary, 'Jose or his W40 summary not found.')
  if (summary.data().correctionId === CORRECTION) return { status: 'already-applied', jose: pick(jose.data()) }
  assert.equal(meta.data().lastAutoProcessedWeekId, WEEK, 'A later close ran; do not overwrite newer state.')
  assert.equal(justSnap.size, 0, 'W40 already has justifications; inspect before proceeding.')
  assert.deepEqual(pick(jose.data()), closedW40.user, 'Jose: state differs from the W40 close')
  for (const [k, v] of Object.entries(closedW40.summary)) assert.equal(summary.data()[k], v, `Jose W40 ${k}`)
  assert(recap.exists, 'W40 recap not found.')

  const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const workouts = woSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  assert.equal(workouts.filter((w) => w.weekId > WEEK).length, 0, 'Workouts after W40 exist; recheck the simulation inputs.')
  const sessions = {}
  for (const w of workouts) (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1

  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: [USER], users: [{ id: USER, ...preW40 }],
    absences, weekWorkouts: workouts.filter((w) => w.weekId === WEEK),
    weekJustifications: [justification], sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  assert.equal(outcome.summaries.length, 1)
  const s = outcome.summaries[0].data
  const finalUser = Object.assign({}, preW40, ...outcome.userUpdates.map((x) => x.data))
  assert.deepEqual(pick(finalUser), expected.user, 'Jose: unexpected final state')
  for (const [k, v] of Object.entries(expected.summary)) assert.equal(s[k], v, `Jose re-close ${k}`)

  const recapSummaries = recap.data().summaries.map((x) => (x.name === 'Jose'
    ? { ...x, status: s.status, fineApplied: 0 } : x))
  assert(monthly.exists && monthly.data().recap.includes(monthlyOld), 'September monthly recap changed; inspect before proceeding.')
  const monthlyPerUser = monthly.data().perUser.map((x) => (x.name === 'Jose'
    ? { ...x, weeksMissed: x.weeksMissed - 1, weeksJustified: x.weeksJustified + 1, finesPaid: x.finesPaid - closedW40.summary.fineApplied } : x))
  const joseMonth = monthlyPerUser.find((x) => x.name === 'Jose')
  assert(joseMonth.weeksMissed === 0 && joseMonth.finesPaid === 0, 'Jose: unexpected September totals')
  const report = { jose: { before: pick(jose.data()), after: pick(finalUser) }, summary: s,
    recap: recapText, monthlyRecap: monthly.data().recap.replace(monthlyOld, monthlyNew), joseSeptember: joseMonth }
  if (!APPLY) return { status: 'dry-run', ...report }

  const backup = { createdAt: new Date().toISOString(), correctionId: CORRECTION,
    user: { id: USER, ...pick(jose.data()) }, summary: summary.data(), recap: recap.data(),
    monthlyRecap: monthly.data(), report }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`${TODAY}-w40-jose-justification-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))

  tx.create(db.collection('justifications').doc(), { ...justification, createdAt: FieldValue.serverTimestamp() })
  tx.update(db.doc(`users/${USER}`), { ...pick(finalUser), updatedAt: FieldValue.serverTimestamp() })
  tx.update(summary.ref, { ...s, correctionId: CORRECTION, correctionNote: note,
    fineForgiven: closedW40.summary.fineApplied, updatedAt: FieldValue.serverTimestamp() })
  tx.update(recap.ref, { recap: recapText, revision: CORRECTION, summaries: recapSummaries,
    updatedAt: FieldValue.serverTimestamp() })
  tx.update(monthly.ref, { recap: report.monthlyRecap, perUser: monthlyPerUser, revision: CORRECTION,
    updatedAt: FieldValue.serverTimestamp() })
  return { status: 'applied', ...report }
})
console.log(JSON.stringify(result, null, 2))
await db.terminate()

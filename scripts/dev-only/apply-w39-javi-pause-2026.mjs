// One-off correction requested by José on 2026-09-28 for week 2026-W39
// (21–27 Sep), already closed with the old rules:
//   - Jose and Javi: admin justification of the full week (Javi's chronic
//     migraine; Jose went with her to the doctor) → fines reverted, Javi's
//     shield restored.
//   - Gonza and Fran: compensation — every W39 session counts as an extra
//     (BONUS_WEEKS in src/game/holidays.js). Fran's 1-session W39 freeze, made
//     minutes before the close, is deleted: the week no longer requires
//     anything, so it would only create debt.
//   - Javi's participation pause from W40 lives in PARTICIPATION_PAUSES.
// Dry-run by default; --apply writes everything in ONE transaction, after
// saving a backup to scripts/dev-only/backups/. Uses the Firebase CLI login;
// never prints or stores credentials.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { computeWeekEndOutcome } from '../../src/game/weekEnd.js'
import { simulateAutoRecovery, getAbsenceRecoveryWindow, isAbsenceRecoverySuspended, isLegacyAbsence } from '../../src/game/absences.js'
import { BONUS_WEEKS, getPause } from '../../src/game/holidays.js'

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
const WEEK = '2026-W39'
const CORRECTION = 'w39-javi-pausa-2026'
const TODAY = '2026-09-28'
const FRAN_W39_FREEZE = '2fiYZVvgahGs4L68OErI'
const bonus = BONUS_WEEKS[WEEK]
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))

// State after the Fiestas Patrias correction (its backup report), i.e. what
// the W39 close started from. Nothing touched users between the two.
const preW39 = {
  user1: { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 1, extraLives: 0, hasShield: false, bankedExtras: 0 },
  user2: { walletBalance: 8334, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: true, bankedExtras: 0 },
  user3: { walletBalance: 4167, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 1, extraLives: 0, hasShield: false, bankedExtras: 0 },
  user4: { walletBalance: 12500, currentFineLevel: 10000, consecutiveMisses: 0, consecutiveSuccesses: 1, extraLives: 0, hasShield: false, bankedExtras: 0 },
}
// What the ordinary W39 close (2026-09-28 00:10) wrote.
const closedW39 = {
  user1: { user: { walletBalance: 25833, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'missed', sessions: 0, fineApplied: 5000, shieldBroken: false } },
  user2: { user: { walletBalance: 10834, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'missed', sessions: 0, fineApplied: 2500, shieldBroken: true } },
  user3: { user: { walletBalance: 4167, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 2, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'completed', sessions: 3, fineApplied: 0, shieldBroken: false } },
  user4: { user: { walletBalance: 12500, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 2, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'completed', sessions: 2, fineApplied: 0, shieldBroken: false, frozenSessions: 1 } },
}
// Expected result of re-closing W39 under the agreement.
const expected = {
  user1: { status: 'justified', sessionsJustified: 3, fineApplied: 0, debtConsumed: 0, extrasBanked: 0,
    user: { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 } },
  user2: { status: 'justified', sessionsJustified: 3, fineApplied: 0, debtConsumed: 0, extrasBanked: 0,
    user: { walletBalance: 8334, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: true, bankedExtras: 0 } },
  user3: { status: 'completed', totalRequired: 0, fineApplied: 0, debtConsumed: 2, extrasBanked: 1,
    user: { walletBalance: 4167, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 2, extraLives: 0, hasShield: false, bankedExtras: 1 } },
  user4: { status: 'completed', totalRequired: 0, fineApplied: 0, debtConsumed: 2, extrasBanked: 0,
    user: { walletBalance: 12500, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 2, extraLives: 0, hasShield: false, bankedExtras: 0 } },
}
const newJustifications = [
  { userId: 'user1', excuse: 'Semana dedicada a acompañar a Javi al doctor por su migraña crónica.',
    aiReason: `Concedida administrativamente por José el ${TODAY}: tuvo que acompañar a Javi al doctor por su migraña crónica y no pudo entrenar en la semana. Retoma normalmente desde la semana 40. NO pasó por el Juez IA.` },
  { userId: 'user2', excuse: 'Semana perdida por migraña crónica, en tratamiento médico.',
    aiReason: `Concedida administrativamente por José el ${TODAY}: Javi está con migraña crónica y no pudo entrenar en la semana. Desde la semana 40 queda en pausa de participación hasta nuevo aviso del doctor. NO pasó por el Juez IA.` },
].map((j) => ({ ...j, weekId: WEEK, sessionsJustified: 3, sessionsRequested: 3, evidencePhotoURL: null,
  aiVerdict: true, status: 'resolved', grantedBy: 'admin', grantedAt: TODAY, appealCount: 0 }))
const notes = {
  user1: 'Semana justificada administrativamente: acompañó a Javi al doctor. Multa de $5.000 revertida.',
  user2: 'Semana justificada administrativamente por migraña crónica. Multa de $2.500 revertida y escudo restituido. Desde la semana 40 queda en pausa hasta nuevo aviso.',
  user3: 'Compensación acordada: todas las sesiones de la semana 39 cuentan como extras.',
  user4: 'Compensación acordada: todas las sesiones de la semana 39 cuentan como extras. Su congelamiento de 1 sesión en esta semana se anuló porque la semana ya no exigía sesiones.',
}

assert(bonus && bonus.userIds.join() === 'user3,user4', 'BONUS_WEEKS must hold the W39 compensation.')
assert(!getPause('user2', WEEK) && getPause('user2', '2026-W40'), 'Javi\'s pause must start at W40.')

const result = await db.runTransaction(async (tx) => {
  const names = ['users', 'absences', 'workouts', 'weekly_summaries']
  const snaps = await Promise.all(names.map((name) => tx.get(db.collection(name))))
  const data = Object.fromEntries(names.map((name, i) => [name, snaps[i].docs.map((d) => ({ id: d.id, ...d.data() }))]))
  const meta = await tx.get(db.doc('settings/meta'))
  const recap = await tx.get(db.doc(`weekly_recaps/${WEEK}`))
  const weekJust = await tx.get(db.collection('justifications').where('weekId', '==', WEEK))

  const weekSummaries = data.weekly_summaries.filter((s) => s.weekId === WEEK)
  assert.equal(weekSummaries.length, 4)
  const appliedCount = weekSummaries.filter((s) => s.correctionId === CORRECTION).length
  if (appliedCount === 4) return { status: 'already-applied', users: data.users.map((u) => ({ name: u.name, ...pick(u) })) }
  assert.equal(appliedCount, 0, 'Partial correction detected; inspect before proceeding.')
  assert.equal(meta.data().lastAutoProcessedWeekId, WEEK, 'A later close ran; do not overwrite newer state.')
  assert.equal(weekJust.size, 0, 'W39 already has justifications; inspect before proceeding.')

  for (const u of data.users) {
    const c = closedW39[u.id]
    assert(c, `Unexpected user ${u.id}`)
    assert.deepEqual(pick(u), c.user, `${u.name}: state differs from the W39 close`)
    const s = weekSummaries.find((x) => x.userId === u.id)
    for (const [k, v] of Object.entries(c.summary)) assert.equal(s[k], v, `${u.name} W39 ${k}`)
    // The close must be exactly preW39 + the ordinary rules, fine included.
    assert.equal(u.walletBalance - preW39[u.id].walletBalance, s.fineApplied)
  }
  const franFreeze = data.absences.find((a) => a.id === FRAN_W39_FREEZE)
  assert(franFreeze, 'Fran\'s W39 freeze not found.')
  assert.equal(franFreeze.userId, 'user4')
  assert.equal(franFreeze.status, 'active')
  assert.deepEqual(franFreeze.frozenWeeks, { [WEEK]: 1 })

  const sessions = {}
  for (const w of data.workouts.filter((w) => w.weekId <= WEEK)) {
    (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
  }
  const absences = data.absences.filter((a) => a.id !== FRAN_W39_FREEZE)
  const restored = data.users.map((u) => ({ id: u.id, ...preW39[u.id] }))
  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: Object.keys(preW39), users: restored,
    absences, weekWorkouts: data.workouts.filter((w) => w.weekId === WEEK),
    weekJustifications: newJustifications, sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  assert.equal(outcome.summaries.length, 4)
  const finalUsers = restored.map((u) => Object.assign({}, u, ...outcome.userUpdates.filter((x) => x.userId === u.id).map((x) => x.data)))
  for (const u of finalUsers) {
    const e = expected[u.id]
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    assert.deepEqual(pick(u), e.user, `${u.id}: unexpected final state`)
    for (const k of ['status', 'sessionsJustified', 'totalRequired', 'fineApplied', 'debtConsumed', 'extrasBanked']) {
      if (k in e) assert.equal(s[k], e[k], `${u.id} ${k}`)
    }
  }

  const active = (abs) => abs.filter((a) => !isLegacyAbsence(a) && a.status !== 'closed')
  const debt = (sim, abs, uid) => active(abs).filter((a) => a.userId === uid).reduce((sum, a) => sum + (sim.remainingDebtByAbsence[a.id] || 0), 0)
  const before = simulateAutoRecovery(data.absences, sessions)
  const after = simulateAutoRecovery(absences, sessions)
  const report = finalUsers.map((u) => {
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    return { name: data.users.find((x) => x.id === u.id).name, status: s.status, sessions: s.sessions,
      totalRequired: s.totalRequired, debtConsumed: s.debtConsumed, extrasBanked: s.extrasBanked,
      fineReverted: closedW39[u.id].summary.fineApplied, walletBefore: closedW39[u.id].user.walletBalance,
      recoveryBefore: debt(before, data.absences, u.id), recoveryAfter: debt(after, absences, u.id), ...pick(u) }
  })
  const recoveryDetails = active(absences).filter((a) => a.frozenWeeks).map((a) => ({ id: a.id, userId: a.userId,
    frozenWeeks: a.frozenWeeks, paidInW39: after.debtConsumedPerAbsenceWeek[a.id]?.[WEEK] || 0,
    remaining: after.remainingDebtByAbsence[a.id], deadline: getAbsenceRecoveryWindow(a, absences).at(-1),
    suspendedByPause: isAbsenceRecoverySuspended(a, absences) }))
  if (!APPLY) return { status: 'dry-run', report, recoveryDetails, recap: bonus.recap }

  const backup = {
    createdAt: new Date().toISOString(), correctionId: CORRECTION,
    users: data.users.map((u) => ({ id: u.id, ...pick(u) })),
    summaries: weekSummaries, recap: recap.exists ? recap.data() : null,
    deletedAbsence: franFreeze, absences: data.absences,
    workouts: data.workouts.filter((w) => w.weekId === WEEK).map((w) => ({ id: w.id, userId: w.userId, weekId: w.weekId, date: w.date })),
    report, recoveryDetails,
  }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`${TODAY}-w39-javi-pause-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))

  for (const j of newJustifications) {
    tx.create(db.collection('justifications').doc(), { ...j, createdAt: FieldValue.serverTimestamp() })
  }
  tx.delete(db.doc(`absences/${FRAN_W39_FREEZE}`))
  for (const u of finalUsers) tx.update(db.doc(`users/${u.id}`), { ...pick(u), updatedAt: FieldValue.serverTimestamp() })
  for (const s of outcome.summaries) {
    const fine = closedW39[s.userId].summary.fineApplied
    tx.update(db.doc(`weekly_summaries/${s.userId}_${WEEK}`), {
      ...s.data, correctionId: CORRECTION, correctionNote: notes[s.userId],
      ...(fine > 0 && { fineForgiven: fine }), updatedAt: FieldValue.serverTimestamp(),
    })
  }
  tx.set(db.doc(`weekly_recaps/${WEEK}`), { weekId: WEEK, recap: bonus.recap, revision: bonus.revision,
    summaries: outcome.summaries.map((s) => ({ userId: s.userId, name: data.users.find((u) => u.id === s.userId).name, ...s.data })),
    createdAt: FieldValue.serverTimestamp(),
  })
  return { status: 'applied', report, recoveryDetails }
})
console.log(JSON.stringify(result, null, 2))
await db.terminate()

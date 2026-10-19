// One-off correction requested by José on 2026-10-19 for week 2026-W42
// (12–18 Oct), already closed with the ordinary rules. The family agreed a
// second "perdonazo masivo" (HOLIDAY_WEEKS in src/game/holidays.js) and Javi's
// return from W43 (PARTICIPATION_PAUSES now ends at W42).
// Nobody logged a W42 session, so the effect is a full revert of the W42 close:
//   - Jose, Gonza, Fran: weekly fines reverted ($5.000 / $10.000 / $10.000),
//     fine level, miss count and streak restored. Javi's W42 stays paused.
//   - Javi's two old freezes (W29–30 and W35, 2 unpaid sessions each), which
//     would fall due at the end of her first week back, are forgiven: closed
//     with no fine and `forgivenWeekId` so they never claim later extras.
//   - Debts not yet due are untouched: Jose's W37 freeze (2 left) now has W44
//     as deadline because W42 no longer counts.
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
import { getHoliday, getPause } from '../../src/game/holidays.js'
import { USER_IDS } from '../../src/game/constants.js'

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
const WEEK = '2026-W42'
const NEXT = '2026-W43'
const CORRECTION = 'perdonazo-w42-2026'
const TODAY = '2026-10-19'
const holiday = getHoliday(WEEK)
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))

// State after the W41 perdonazo, i.e. what the W42 close started from.
const preW42 = {
  user1: { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
  user2: { walletBalance: 8334, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: true, bankedExtras: 0 },
  user3: { walletBalance: 9167, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 1 },
  user4: { walletBalance: 17500, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
}
// What the ordinary W42 close (2026-10-19 00:10) wrote.
const closedW42 = {
  user1: { user: { ...preW42.user1, walletBalance: 25833, currentFineLevel: 10000, consecutiveMisses: 1 },
    summary: { status: 'missed', sessions: 0, fineApplied: 5000 } },
  user2: { user: preW42.user2, summary: { status: 'paused', sessions: 0, fineApplied: 0 } },
  user3: { user: { ...preW42.user3, walletBalance: 19167, currentFineLevel: 20000, consecutiveMisses: 2 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 } },
  user4: { user: { ...preW42.user4, walletBalance: 27500, currentFineLevel: 20000, consecutiveMisses: 2 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 } },
}
// Javi's freezes, suspended during her pause, forgiven at her return.
const forgiven = {
  yY8ooM8Q7MAzy7aNeeHg: { frozenWeeks: { '2026-W29': 3, '2026-W30': 1 }, totalDebt: 4, debtUnpaid: 2 },
  '0mKAUMUzlPDcazA30JqR': { frozenWeeks: { '2026-W35': 2 }, totalDebt: 2, debtUnpaid: 2 },
}
const forgivenNote = `Perdonazo masivo de la semana 42 acordado en familia (${TODAY}): al volver de su pausa médica, las 2 sesiones que le faltaban de este congelamiento quedaron perdonadas, sin multa.`
const notes = {
  user1: 'Perdonazo masivo acordado en familia: semana libre. Multa de $5.000 revertida; nivel de multa y racha restituidos.',
  user3: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
  user4: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
}

assert(holiday && holiday.name === 'Perdonazo masivo', 'HOLIDAY_WEEKS must hold the W42 perdonazo.')
assert(getPause('user2', WEEK) && !getPause('user2', NEXT), "Javi's pause must end at W42.")

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
  if (appliedCount === 3) return { status: 'already-applied', users: data.users.map((u) => ({ name: u.name, ...pick(u) })) }
  assert.equal(appliedCount, 0, 'Partial correction detected; inspect before proceeding.')
  assert.equal(meta.data().lastAutoProcessedWeekId, WEEK, 'A later close ran; do not overwrite newer state.')
  assert.equal(weekJust.size, 0, 'W42 has justifications; inspect before proceeding.')
  const weekWorkouts = data.workouts.filter((w) => w.weekId === WEEK)
  assert.equal(weekWorkouts.length, 0, 'Someone logged a W42 session; recheck the expected result.')

  for (const u of data.users) {
    const c = closedW42[u.id]
    assert(c, `Unexpected user ${u.id}`)
    assert.deepEqual(pick(u), c.user, `${u.name}: state differs from the W42 close`)
    const s = weekSummaries.find((x) => x.userId === u.id)
    for (const [k, v] of Object.entries(c.summary)) assert.equal(s[k], v, `${u.name} W42 ${k}`)
    // The close must be exactly preW42 + the weekly fine: nothing else settled.
    assert.equal(u.walletBalance - preW42[u.id].walletBalance, s.fineApplied, `${u.name} wallet delta`)
  }
  assert.deepEqual(data.absences.filter((a) => String(a.closedAt || '').startsWith('2026-10-19')), [],
    'The W42 close settled an absence; recheck the expected result.')

  const sessions = {}
  for (const w of data.workouts) {
    (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
  }
  const simBefore = simulateAutoRecovery(data.absences, sessions)
  for (const [id, f] of Object.entries(forgiven)) {
    const a = data.absences.find((x) => x.id === id)
    assert(a, `Absence ${id} not found.`)
    assert.equal(a.userId, 'user2')
    assert.equal(a.status, 'active')
    assert.deepEqual(a.frozenWeeks, f.frozenWeeks)
    assert.equal(simBefore.remainingDebtByAbsence[id], f.debtUnpaid, `${id} unpaid debt`)
    // Without forgiveness both would fall due at the end of her first week back.
    assert.equal(getAbsenceRecoveryWindow(a, data.absences).at(-1), NEXT, `${id} deadline`)
    assert.equal(isAbsenceRecoverySuspended(a, data.absences), false)
  }
  // What the W43 close would charge her for them even if she met her goal.
  const javiW43 = Array.from({ length: 3 }, () => ({ userId: 'user2', weekId: NEXT }))
  const wouldCharge = computeWeekEndOutcome({ weekId: NEXT, userIds: ['user2'], users: [{ id: 'user2', ...preW42.user2 }],
    absences: data.absences, weekWorkouts: javiW43, weekJustifications: [],
    sessionsByUserWeek: { ...sessions, user2: { ...sessions.user2, [NEXT]: 3 } } }).absenceUpdates
  assert.deepEqual(wouldCharge.map((x) => x.absenceId).sort(), Object.keys(forgiven).sort())
  const fineForgiven = Object.fromEntries(wouldCharge.map((x) => [x.absenceId, x.data.fineApplied]))

  const closedAt = new Date().toISOString()
  const absences = data.absences.map((a) => (forgiven[a.id]
    ? { ...a, status: 'closed', closedAt, totalDebt: forgiven[a.id].totalDebt, debtUnpaid: forgiven[a.id].debtUnpaid,
        fineApplied: 0, forgivenWeekId: WEEK } : a))
  const restored = data.users.map((u) => ({ id: u.id, ...preW42[u.id] }))
  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: USER_IDS, users: restored,
    absences, weekWorkouts, weekJustifications: [], sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  assert.equal(outcome.summaries.length, 4)
  const finalUsers = restored.map((u) => Object.assign({}, u, ...outcome.userUpdates.filter((x) => x.userId === u.id).map((x) => x.data)))
  for (const u of finalUsers) {
    assert.deepEqual(pick(u), preW42[u.id], `${u.id}: a free week must leave every stat as it was`)
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    assert.equal(s.status, u.id === 'user2' ? 'paused' : 'holiday', `${u.id} status`)
    assert.equal(s.fineApplied, 0)
  }
  // After the fix, meeting her goal in W43 settles nothing for Javi.
  assert.deepEqual(computeWeekEndOutcome({ weekId: NEXT, userIds: ['user2'], users: [{ id: 'user2', ...preW42.user2 }],
    absences, weekWorkouts: javiW43, weekJustifications: [],
    sessionsByUserWeek: { ...sessions, user2: { ...sessions.user2, [NEXT]: 3 } } }).absenceUpdates, [])

  const active = absences.filter((a) => !isLegacyAbsence(a) && a.status !== 'closed' && a.frozenWeeks)
  const after = simulateAutoRecovery(absences, sessions)
  const recoveryDetails = active.map((a) => ({ id: a.id, userId: a.userId, frozenWeeks: a.frozenWeeks,
    remaining: after.remainingDebtByAbsence[a.id], deadline: getAbsenceRecoveryWindow(a, absences).at(-1),
    suspendedByPause: isAbsenceRecoverySuspended(a, absences) }))
  const report = finalUsers.map((u) => ({ name: data.users.find((x) => x.id === u.id).name,
    status: outcome.summaries.find((x) => x.userId === u.id).data.status,
    fineReverted: closedW42[u.id].summary.fineApplied,
    walletBefore: closedW42[u.id].user.walletBalance, ...pick(u) }))
  if (!APPLY) return { status: 'dry-run', report, fineForgiven, recoveryDetails, recap: holiday.recap }

  const backup = {
    createdAt: new Date().toISOString(), correctionId: CORRECTION,
    users: data.users.map((u) => ({ id: u.id, ...pick(u) })),
    summaries: weekSummaries, recap: recap.exists ? recap.data() : null,
    forgivenAbsences: data.absences.filter((a) => forgiven[a.id]), absences: data.absences,
    report, fineForgiven, recoveryDetails,
  }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`${TODAY}-w42-perdonazo-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))

  for (const u of finalUsers) tx.update(db.doc(`users/${u.id}`), { ...pick(u), updatedAt: FieldValue.serverTimestamp() })
  for (const s of outcome.summaries) {
    if (s.userId === 'user2') continue // paused through W42; the close already wrote exactly this
    tx.update(db.doc(`weekly_summaries/${s.userId}_${WEEK}`), {
      ...s.data, correctionId: CORRECTION, correctionNote: notes[s.userId],
      fineForgiven: closedW42[s.userId].summary.fineApplied, updatedAt: FieldValue.serverTimestamp(),
    })
  }
  for (const [id, f] of Object.entries(forgiven)) {
    tx.update(db.doc(`absences/${id}`), { status: 'closed', closedAt, totalDebt: f.totalDebt, debtUnpaid: f.debtUnpaid,
      fineApplied: 0, fineForgiven: fineForgiven[id], forgivenWeekId: WEEK, forgivenNote,
      updatedAt: FieldValue.serverTimestamp() })
  }
  tx.set(db.doc(`weekly_recaps/${WEEK}`), { weekId: WEEK, recap: holiday.recap,
    holidayName: holiday.name, revision: holiday.revision,
    summaries: outcome.summaries.map((s) => ({ userId: s.userId, name: data.users.find((u) => u.id === s.userId).name, ...s.data })),
    createdAt: FieldValue.serverTimestamp(),
  })
  return { status: 'applied', report, fineForgiven, recoveryDetails }
})
console.log(JSON.stringify(result, null, 2))
await db.terminate()

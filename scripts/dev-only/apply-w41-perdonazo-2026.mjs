// One-off correction requested by José on 2026-10-12 for week 2026-W41
// (5–11 Oct), already closed with the ordinary rules. The family agreed a
// "perdonazo masivo" during the week: whoever trained gets every session as an
// extra, everyone else is forgiven (HOLIDAY_WEEKS in src/game/holidays.js).
// Nobody logged a session, so the effect is a full revert of the W41 close:
//   - Jose, Gonza, Fran: weekly fines reverted ($5.000 / $10.000 / $10.000),
//     fine level, miss count and streak restored. Javi stays paused.
//   - Jose's two old freezes settled at the same close (W29–30 and W35, 3
//     unpaid sessions each, $5.000 each) are forgiven: they stay closed with no
//     fine and `forgivenWeekId` so they never claim later extras. Their frozen
//     weeks' summaries go back to what they were before the settlement.
//   - Debts not yet due are untouched: Jose's W37 freeze (2 left) now has W43
//     as deadline because W41 no longer counts; Javi's freezes stay suspended.
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
import { getHoliday } from '../../src/game/holidays.js'
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
const WEEK = '2026-W41'
const CORRECTION = 'perdonazo-w41-2026'
const TODAY = '2026-10-12'
const holiday = getHoliday(WEEK)
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))

// State after the W40 close (and Jose's W40 correction), i.e. what the W41
// close started from. Nothing touched users between the two.
const preW41 = {
  user1: { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
  user2: { walletBalance: 8334, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: true, bankedExtras: 0 },
  user3: { walletBalance: 9167, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 1 },
  user4: { walletBalance: 17500, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
}
// What the ordinary W41 close (2026-10-12 00:10) wrote.
const closedW41 = {
  user1: { user: { walletBalance: 35833, currentFineLevel: 10000, consecutiveMisses: 3, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'missed', sessions: 0, fineApplied: 5000 }, settlementFines: 10000 },
  user2: { user: preW41.user2, summary: { status: 'paused', sessions: 0, fineApplied: 0 }, settlementFines: 0 },
  user3: { user: { walletBalance: 19167, currentFineLevel: 20000, consecutiveMisses: 2, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 1 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 }, settlementFines: 0 },
  user4: { user: { walletBalance: 27500, currentFineLevel: 20000, consecutiveMisses: 2, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 }, settlementFines: 0 },
}
// Jose's freezes settled by the W41 close, now forgiven.
const forgiven = {
  wPUvg3zsXIpD0eqYHoTD: { frozenWeeks: { '2026-W29': 3, '2026-W30': 1 }, debtUnpaid: 3, fineApplied: 5000 },
  VhWccZHEgWIGajT6HDzg: { frozenWeeks: { '2026-W35': 3 }, debtUnpaid: 3, fineApplied: 5000 },
}
// Frozen-week summaries the settlement marked as fined, and what they held
// before it (verified with a from-zero replay up to W40).
const settledSummaries = {
  'user1_2026-W29': { now: { status: 'missed', fineApplied: 2500, debtUnpaid: 3 }, before: { status: 'frozen', fineApplied: 0 } },
  'user1_2026-W30': { now: { status: 'missed', fineApplied: 2500, debtUnpaid: 3 }, before: { status: 'justified', fineApplied: 0 } },
  'user1_2026-W35': { now: { status: 'missed', fineApplied: 5000, debtUnpaid: 3 }, before: { status: 'frozen', fineApplied: 0 } },
}
const forgivenNote = `Perdonazo masivo de la semana 41 acordado en familia (${TODAY}): la deuda de 3 sesiones que vencía esa semana quedó perdonada, sin multa.`
const notes = {
  user1: 'Perdonazo masivo acordado en familia: semana libre. Multa semanal de $5.000 revertida, y sus congelamientos de W29–30 y W35 (que vencían esta semana, $5.000 cada uno) quedaron perdonados.',
  user3: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
  user4: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
}

assert(holiday && holiday.name === 'Perdonazo masivo', 'HOLIDAY_WEEKS must hold the W41 perdonazo.')

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
  assert.equal(weekJust.size, 0, 'W41 has justifications; inspect before proceeding.')
  const weekWorkouts = data.workouts.filter((w) => w.weekId === WEEK)
  assert.equal(weekWorkouts.length, 0, 'Someone logged a W41 session; recheck the expected result.')

  for (const u of data.users) {
    const c = closedW41[u.id]
    assert(c, `Unexpected user ${u.id}`)
    assert.deepEqual(pick(u), c.user, `${u.name}: state differs from the W41 close`)
    const s = weekSummaries.find((x) => x.userId === u.id)
    for (const [k, v] of Object.entries(c.summary)) assert.equal(s[k], v, `${u.name} W41 ${k}`)
    // The close must be exactly preW41 + the ordinary rules, fines included.
    assert.equal(u.walletBalance - preW41[u.id].walletBalance, s.fineApplied + c.settlementFines, `${u.name} wallet delta`)
  }
  for (const [id, f] of Object.entries(forgiven)) {
    const a = data.absences.find((x) => x.id === id)
    assert(a, `Absence ${id} not found.`)
    assert.equal(a.userId, 'user1')
    assert.equal(a.status, 'closed')
    assert.deepEqual(a.frozenWeeks, f.frozenWeeks)
    assert.equal(a.debtUnpaid, f.debtUnpaid)
    assert.equal(a.fineApplied, f.fineApplied)
    assert(a.closedAt?.startsWith('2026-10-12T03:10'), `${id} was not settled by the W41 close`)
  }
  for (const [id, e] of Object.entries(settledSummaries)) {
    const s = data.weekly_summaries.find((x) => x.id === id)
    assert(s, `${id} not found`)
    for (const [k, v] of Object.entries(e.now)) assert.equal(s[k], v, `${id} ${k}`)
  }
  // Every other absence the W41 close touched must have been settled at no cost.
  const otherClosedNow = data.absences.filter((a) => !forgiven[a.id] && a.closedAt?.startsWith?.('2026-10-12'))
  assert.deepEqual(otherClosedNow.map((a) => [a.id, a.fineApplied, a.debtUnpaid]), [['SO9E5upjOkIFc7Sdrsk6', 0, 0]])

  const sessions = {}
  for (const w of data.workouts.filter((w) => w.weekId <= WEEK)) {
    (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
  }
  const absences = data.absences.map((a) => (forgiven[a.id]
    ? { ...a, fineApplied: 0, forgivenWeekId: WEEK } : a))
  const restored = data.users.map((u) => ({ id: u.id, ...preW41[u.id] }))
  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: USER_IDS, users: restored,
    absences, weekWorkouts, weekJustifications: [], sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  assert.equal(outcome.summaries.length, 4)
  const finalUsers = restored.map((u) => Object.assign({}, u, ...outcome.userUpdates.filter((x) => x.userId === u.id).map((x) => x.data)))
  for (const u of finalUsers) {
    assert.deepEqual(pick(u), preW41[u.id], `${u.id}: a free week must leave every stat as it was`)
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    assert.equal(s.status, u.id === 'user2' ? 'paused' : 'holiday', `${u.id} status`)
    assert.equal(s.fineApplied, 0)
  }

  const active = absences.filter((a) => !isLegacyAbsence(a) && a.status !== 'closed' && a.frozenWeeks)
  const after = simulateAutoRecovery(absences, sessions)
  const recoveryDetails = active.map((a) => ({ id: a.id, userId: a.userId, frozenWeeks: a.frozenWeeks,
    remaining: after.remainingDebtByAbsence[a.id], deadline: getAbsenceRecoveryWindow(a, absences).at(-1),
    suspendedByPause: isAbsenceRecoverySuspended(a, absences) }))
  const report = finalUsers.map((u) => ({ name: data.users.find((x) => x.id === u.id).name,
    status: outcome.summaries.find((x) => x.userId === u.id).data.status,
    fineReverted: closedW41[u.id].summary.fineApplied + closedW41[u.id].settlementFines,
    walletBefore: closedW41[u.id].user.walletBalance, ...pick(u) }))
  if (!APPLY) return { status: 'dry-run', report, recoveryDetails, recap: holiday.recap }

  const backup = {
    createdAt: new Date().toISOString(), correctionId: CORRECTION,
    users: data.users.map((u) => ({ id: u.id, ...pick(u) })),
    summaries: weekSummaries, settledSummaries: data.weekly_summaries.filter((s) => settledSummaries[s.id]),
    recap: recap.exists ? recap.data() : null,
    forgivenAbsences: data.absences.filter((a) => forgiven[a.id]), absences: data.absences,
    report, recoveryDetails,
  }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`${TODAY}-w41-perdonazo-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))

  for (const u of finalUsers) tx.update(db.doc(`users/${u.id}`), { ...pick(u), updatedAt: FieldValue.serverTimestamp() })
  for (const s of outcome.summaries) {
    if (s.userId === 'user2') continue // still paused; the close already wrote exactly this
    tx.update(db.doc(`weekly_summaries/${s.userId}_${WEEK}`), {
      ...s.data, correctionId: CORRECTION, correctionNote: notes[s.userId],
      fineForgiven: closedW41[s.userId].summary.fineApplied, updatedAt: FieldValue.serverTimestamp(),
    })
  }
  for (const [id, e] of Object.entries(settledSummaries)) {
    tx.update(db.doc(`weekly_summaries/${id}`), { ...e.before, debtUnpaid: FieldValue.delete(),
      correctionId: CORRECTION, forgivenNote, fineForgiven: e.now.fineApplied, updatedAt: FieldValue.serverTimestamp() })
  }
  for (const [id, f] of Object.entries(forgiven)) {
    tx.update(db.doc(`absences/${id}`), { fineApplied: 0, fineForgiven: f.fineApplied, forgivenWeekId: WEEK,
      forgivenNote, updatedAt: FieldValue.serverTimestamp() })
  }
  tx.set(db.doc(`weekly_recaps/${WEEK}`), { weekId: WEEK, recap: holiday.recap,
    holidayName: holiday.name, revision: holiday.revision,
    summaries: outcome.summaries.map((s) => ({ userId: s.userId, name: data.users.find((u) => u.id === s.userId).name, ...s.data })),
    createdAt: FieldValue.serverTimestamp(),
  })
  return { status: 'applied', report, recoveryDetails }
})
console.log(JSON.stringify(result, null, 2))
await db.terminate()

// One-off correction requested by José on 2026-10-27 for week 2026-W43
// (19–25 Oct), already closed with the ordinary rules. The family agreed a
// third "perdonazo masivo" (HOLIDAY_WEEKS in src/game/holidays.js): the week
// requires nothing and every session logged in it is an extra, which first
// repays recovery debt and then goes to the bank.
//   - Jose (2/3, fined $5.000): fine reverted, fine level and streak restored;
//     his 2 sessions repay his W37 freeze (2 left), which now closes free.
//   - Javi (2/3, fined $2.500 + shield broken): fine reverted, shield, fine
//     level and streak restored; her 2 sessions go to the bank.
//   - Gonza, Fran (0/3, fined $10.000 each): fines reverted, stats restored.
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
const WEEK = '2026-W43'
const CORRECTION = 'perdonazo-w43-2026'
const TODAY = '2026-10-27'
const holiday = getHoliday(WEEK)
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))

// State after the W42 perdonazo, i.e. what the W43 close started from.
const preW43 = {
  user1: { walletBalance: 20833, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
  user2: { walletBalance: 8334, currentFineLevel: 5000, consecutiveMisses: 0, consecutiveSuccesses: 0, extraLives: 0, hasShield: true, bankedExtras: 0 },
  user3: { walletBalance: 9167, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 1 },
  user4: { walletBalance: 17500, currentFineLevel: 10000, consecutiveMisses: 1, consecutiveSuccesses: 0, extraLives: 0, hasShield: false, bankedExtras: 0 },
}
// What the ordinary W43 close (2026-10-26 00:10) wrote.
const closedW43 = {
  user1: { user: { ...preW43.user1, walletBalance: 25833, currentFineLevel: 10000, consecutiveMisses: 1 },
    summary: { status: 'missed', sessions: 2, fineApplied: 5000 } },
  user2: { user: { ...preW43.user2, walletBalance: 10834, currentFineLevel: 10000, consecutiveMisses: 1, hasShield: false },
    summary: { status: 'missed', sessions: 2, fineApplied: 2500, shieldBroken: true } },
  user3: { user: { ...preW43.user3, walletBalance: 19167, currentFineLevel: 20000, consecutiveMisses: 2 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 } },
  user4: { user: { ...preW43.user4, walletBalance: 27500, currentFineLevel: 20000, consecutiveMisses: 2 },
    summary: { status: 'missed', sessions: 0, fineApplied: 10000 } },
}
// Agreed outcome: same stats as before the week, plus the extras.
const expected = {
  user1: { user: preW43.user1, summary: { debtConsumed: 2, extrasBanked: 0 } },
  user2: { user: { ...preW43.user2, bankedExtras: 2 }, summary: { debtConsumed: 0, extrasBanked: 2 } },
  user3: { user: preW43.user3, summary: { debtConsumed: 0, extrasBanked: 0 } },
  user4: { user: preW43.user4, summary: { debtConsumed: 0, extrasBanked: 0 } },
}
const notes = {
  user1: 'Perdonazo masivo acordado en familia: semana libre. Multa de $5.000 revertida; sus 2 sesiones cuentan como extras y terminaron de pagar su congelamiento de la semana 37.',
  user2: 'Perdonazo masivo acordado en familia: semana libre. Multa de $2.500 revertida y escudo restituido; sus 2 sesiones quedaron como extras en el banco.',
  user3: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
  user4: 'Perdonazo masivo acordado en familia: semana libre. Multa de $10.000 revertida; nivel de multa y racha restituidos.',
}

assert(holiday && holiday.name === 'Perdonazo masivo', 'HOLIDAY_WEEKS must hold the W43 perdonazo.')

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
  assert.equal(weekJust.size, 0, 'W43 has justifications; inspect before proceeding.')
  const weekWorkouts = data.workouts.filter((w) => w.weekId === WEEK)

  for (const u of data.users) {
    const c = closedW43[u.id]
    assert(c, `Unexpected user ${u.id}`)
    assert.deepEqual(pick(u), c.user, `${u.name}: state differs from the W43 close`)
    const s = weekSummaries.find((x) => x.userId === u.id)
    for (const [k, v] of Object.entries(c.summary)) assert.equal(s[k], v, `${u.name} W43 ${k}`)
    assert.equal(weekWorkouts.filter((w) => w.userId === u.id).length, c.summary.sessions, `${u.name} W43 sessions`)
    // The close must be exactly preW43 + the weekly fine: nothing else settled.
    assert.equal(u.walletBalance - preW43[u.id].walletBalance, s.fineApplied, `${u.name} wallet delta`)
  }
  assert.deepEqual(data.absences.filter((a) => String(a.closedAt || '').startsWith('2026-10-26')), [],
    'The W43 close settled an absence; recheck the expected result.')

  // Sessions as the close saw them: nothing after the week it settles.
  const sessions = {}
  for (const w of data.workouts.filter((w) => w.weekId <= WEEK)) {
    (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
  }
  const restored = data.users.map((u) => ({ id: u.id, ...preW43[u.id] }))
  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: USER_IDS, users: restored,
    absences: data.absences, weekWorkouts, weekJustifications: [], sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  assert.equal(outcome.summaries.length, 4)
  const finalUsers = restored.map((u) => Object.assign({}, u, ...outcome.userUpdates.filter((x) => x.userId === u.id).map((x) => x.data)))
  for (const u of finalUsers) {
    assert.deepEqual(pick(u), expected[u.id].user, `${u.id}: final stats`)
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    assert.equal(s.status, 'holiday', `${u.id} status`)
    assert.equal(s.fineApplied, 0)
    for (const [k, v] of Object.entries(expected[u.id].summary)) assert.equal(s[k], v, `${u.id} ${k}`)
  }

  const active = data.absences.filter((a) => !isLegacyAbsence(a) && a.status !== 'closed' && a.frozenWeeks)
  const after = simulateAutoRecovery(data.absences, sessions)
  const recoveryDetails = active.map((a) => ({ id: a.id, userId: a.userId, frozenWeeks: a.frozenWeeks,
    remaining: after.remainingDebtByAbsence[a.id], deadline: getAbsenceRecoveryWindow(a, data.absences).at(-1),
    suspendedByPause: isAbsenceRecoverySuspended(a, data.absences) }))
  assert.equal(recoveryDetails.find((a) => a.id === 'uo3ZXgHRF8wK2pAEJLyR')?.remaining, 0, "Jose's W37 freeze must be repaid")
  const report = finalUsers.map((u) => {
    const s = outcome.summaries.find((x) => x.userId === u.id).data
    return { name: data.users.find((x) => x.id === u.id).name, status: s.status, sessions: s.sessions,
      debtConsumed: s.debtConsumed, extrasBanked: s.extrasBanked,
      fineReverted: closedW43[u.id].summary.fineApplied, walletBefore: closedW43[u.id].user.walletBalance, ...pick(u) }
  })
  if (!APPLY) return { status: 'dry-run', report, recoveryDetails, recap: holiday.recap }

  const backup = {
    createdAt: new Date().toISOString(), correctionId: CORRECTION,
    users: data.users.map((u) => ({ id: u.id, ...pick(u) })),
    summaries: weekSummaries, recap: recap.exists ? recap.data() : null,
    absences: data.absences, report, recoveryDetails,
  }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`${TODAY}-w43-perdonazo-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))

  for (const u of finalUsers) tx.update(db.doc(`users/${u.id}`), { ...pick(u), updatedAt: FieldValue.serverTimestamp() })
  for (const s of outcome.summaries) {
    tx.update(db.doc(`weekly_summaries/${s.userId}_${WEEK}`), {
      ...s.data, correctionId: CORRECTION, correctionNote: notes[s.userId],
      fineForgiven: closedW43[s.userId].summary.fineApplied, updatedAt: FieldValue.serverTimestamp(),
    })
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

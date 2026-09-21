// One-off correction requested by José on 2026-09-21.
// Dry-run by default; --apply atomically updates only W38 game state and recap.
// Uses the existing Firebase CLI login; never prints or stores credentials.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { computeWeekEndOutcome } from '../../src/game/weekEnd.js'
import { simulateAutoRecovery, getAbsenceRecoveryWindow, isLegacyAbsence } from '../../src/game/absences.js'
import { getHoliday } from '../../src/game/holidays.js'

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
const WEEK = '2026-W38'
const CORRECTION = 'fiestas-patrias-2026'
const holiday = getHoliday(WEEK)
const fields = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'extraLives', 'hasShield', 'bankedExtras']
const pick = (u) => Object.fromEntries(fields.map((k) => [k, u[k] ?? (k === 'hasShield' ? false : 0)]))
const expected = {
  user1: { wallet: 25833, fine: 5000, level: 10000, sessions: 1, streak: 1, shield: false },
  user2: { wallet: 10834, fine: 2500, level: 10000, sessions: 1, streak: 0, shield: true },
  user3: { wallet: 9167, fine: 5000, level: 10000, sessions: 1, streak: 1, shield: false },
  user4: { wallet: 22500, fine: 10000, level: 20000, sessions: 0, streak: 1, shield: false },
}

const result = await db.runTransaction(async (tx) => {
  const names = ['users', 'absences', 'workouts', 'weekly_summaries']
  const snaps = await Promise.all(names.map((name) => tx.get(db.collection(name))))
  const data = Object.fromEntries(names.map((name, i) => [name, snaps[i].docs.map((d) => ({ id: d.id, ...d.data() }))]))
  const meta = await tx.get(db.doc('settings/meta'))
  const recap = await tx.get(db.doc(`weekly_recaps/${WEEK}`))
  const holidaySummaries = data.weekly_summaries.filter((s) => s.weekId === WEEK)
  assert.equal(holidaySummaries.length, 4)
  const appliedCount = holidaySummaries.filter((s) => s.correctionId === CORRECTION).length
  if (appliedCount === 4) {
    assert.equal(recap.data()?.recap, holiday.recap)
    return { status: 'already-applied', users: data.users.map((u) => ({ name: u.name, ...pick(u) })) }
  }
  assert.equal(appliedCount, 0, 'Partial correction detected; inspect before proceeding.')
  assert.equal(meta.data().lastAutoProcessedWeekId, WEEK, 'A later close ran; do not overwrite newer state.')

  const sessions = {}
  for (const w of data.workouts.filter((w) => w.weekId <= WEEK)) {
    (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1
  }
  const restored = data.users.map((u) => {
    const e = expected[u.id]
    assert(e, `Unexpected user ${u.id}`)
    const s = holidaySummaries.find((s) => s.userId === u.id)
    assert.equal(u.walletBalance, e.wallet)
    assert.equal(u.currentFineLevel, e.level)
    assert.equal(u.consecutiveMisses, 1)
    assert.equal(u.consecutiveSuccesses, 0)
    assert.equal(u.hasShield, false)
    assert.equal(u.extraLives, 0)
    assert.equal(u.bankedExtras, 0)
    assert.equal(s.status, 'missed')
    assert.equal(s.fineApplied, e.fine)
    assert.equal(s.shieldBroken, e.shield)
    assert.equal(s.sessions, e.sessions)
    assert.equal(sessions[u.id]?.[WEEK] || 0, e.sessions)
    for (const k of ['extrasBanked', 'extrasRedeemed', 'fineReducedByCanje', 'debtConsumed']) assert.equal(s[k] || 0, 0)
    assert.equal(s.lifeUsed, false)
    // Verify the pre-holiday streak from the recorded preceding weeks.
    let streak = 0
    for (const prior of data.weekly_summaries.filter((s) => s.userId === u.id && s.weekId < WEEK).sort((a, b) => b.weekId.localeCompare(a.weekId))) {
      if (['frozen', 'holiday'].includes(prior.status)) continue
      if (prior.status !== 'completed' && !prior.lifeUsed) break
      streak++
    }
    assert.equal(streak, e.streak)
    return { id: u.id, ...pick(u), walletBalance: u.walletBalance - s.fineApplied,
      currentFineLevel: u.currentFineLevel / 2, consecutiveMisses: 0,
      consecutiveSuccesses: streak, hasShield: e.shield }
  })
  const outcome = computeWeekEndOutcome({ weekId: WEEK, userIds: Object.keys(expected), users: restored,
    absences: data.absences, weekWorkouts: data.workouts.filter((w) => w.weekId === WEEK),
    weekJustifications: [], sessionsByUserWeek: sessions })
  assert.equal(outcome.absenceUpdates.length, 0, 'Unexpected absence settlement.')
  const finalUsers = restored.map((u) => Object.assign({}, u, ...outcome.userUpdates.filter((x) => x.userId === u.id).map((x) => x.data)))
  const oldSessions = structuredClone(sessions)
  for (const uid of Object.keys(expected)) oldSessions[uid][WEEK] = 0
  const beforeRecovery = simulateAutoRecovery(data.absences, oldSessions)
  const afterRecovery = simulateAutoRecovery(data.absences, sessions)
  const active = data.absences.filter((a) => !isLegacyAbsence(a) && a.status !== 'closed')
  const debt = (sim, uid) => active.filter((a) => a.userId === uid).reduce((sum, a) => sum + (sim.remainingDebtByAbsence[a.id] || 0), 0)
  const report = finalUsers.map((u) => ({ name: data.users.find((x) => x.id === u.id).name,
    fineForgiven: expected[u.id].fine, balanceBefore: expected[u.id].wallet, balanceAfter: u.walletBalance,
    recoveryBefore: debt(beforeRecovery, u.id), recoveryAfter: debt(afterRecovery, u.id), ...pick(u) }))
  const recoveryDetails = active.map((a) => ({ id: a.id, userId: a.userId, frozenWeeks: a.frozenWeeks,
    recoveredOnHoliday: afterRecovery.debtConsumedPerAbsenceWeek[a.id]?.[WEEK] || 0,
    remaining: afterRecovery.remainingDebtByAbsence[a.id], deadline: getAbsenceRecoveryWindow(a, data.absences).at(-1) }))
  for (const s of outcome.summaries) {
    assert.equal(s.data.debtConsumed, expected[s.userId].sessions)
    assert.equal(s.data.extrasBanked, 0)
  }
  if (!APPLY) return { status: 'dry-run', report, recoveryDetails, recap: holiday.recap }

  const backup = {
    createdAt: new Date().toISOString(), correctionId: CORRECTION,
    users: data.users.map((u) => ({ id: u.id, ...pick(u) })),
    summaries: holidaySummaries, recap: recap.exists ? recap.data() : null,
    absences: data.absences, workouts: data.workouts.filter((w) => w.weekId === WEEK).map((w) => ({ id: w.id, userId: w.userId, weekId: w.weekId, date: w.date })),
    report, recoveryDetails,
  }
  const backupDir = new URL('./backups/', import.meta.url)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(new URL(`2026-09-21-fiestas-patrias-${Date.now()}-before.json`, backupDir), JSON.stringify(backup, null, 2))
  for (const u of finalUsers) tx.update(db.doc(`users/${u.id}`), { ...pick(u), updatedAt: FieldValue.serverTimestamp() })
  for (const s of outcome.summaries) tx.update(db.doc(`weekly_summaries/${s.userId}_${WEEK}`), {
    ...s.data, correctionId: CORRECTION, fineForgiven: expected[s.userId].fine,
    correctionNote: 'Semana libre del 14 al 20 de septiembre acordada por toda la familia por Fiestas Patrias. Multa y efectos revertidos; todos los entrenamientos cuentan como extras para recuperación. No genera deuda nueva.',
    updatedAt: FieldValue.serverTimestamp(),
  })
  tx.set(db.doc(`weekly_recaps/${WEEK}`), { weekId: WEEK, recap: holiday.recap,
    holidayName: holiday.name, revision: holiday.revision,
    summaries: outcome.summaries.map((s) => ({ userId: s.userId, name: data.users.find((u) => u.id === s.userId).name, ...s.data })),
    createdAt: FieldValue.serverTimestamp(),
  })
  return { status: 'applied', report, recoveryDetails, recap: holiday.recap }
})
console.log(JSON.stringify(result, null, 2))
await db.terminate()

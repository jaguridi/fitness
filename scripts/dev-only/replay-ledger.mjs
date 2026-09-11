// Read-only diagnostic: replay EVERY closed week from zero with the CURRENT game
// rules (src/game) and compare, week by week, with what Firestore actually holds.
//
// Why: the week-end close is not idempotent (fines are ADDED to the wallet), so
// rewinding the lock and re-running weeks — or closing weeks under rules that
// later changed — leaves the stored ledger drifting from what the rules say.
// This tool shows exactly where.
//
// Usage: node scripts/dev-only/replay-ledger.mjs [--from 2026-W09] [--quiet]
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { computeWeekEndOutcome } from '../../src/game/weekEnd.js'
import { getNextWeekId } from '../../src/game/weekId.js'
import { USER_IDS, BASE_FINE } from '../../src/game/constants.js'

const args = process.argv.slice(2)
const FROM = args.includes('--from') ? args[args.indexOf('--from') + 1] : '2026-W09'
const QUIET = args.includes('--quiet')
const NAMES = { user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' }

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI', authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e', storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}))

const [usersSnap, woSnap, absSnap, sumSnap, jusSnap, metaSnap] = await Promise.all([
  getDocs(collection(db, 'users')), getDocs(collection(db, 'workouts')), getDocs(collection(db, 'absences')),
  getDocs(collection(db, 'weekly_summaries')), getDocs(collection(db, 'justifications')), getDoc(doc(db, 'settings', 'meta')),
])
const actualUsers = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
const workouts = woSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const actualAbsences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const actualSummaries = Object.fromEntries(sumSnap.docs.map((d) => [d.id, d.data()]))
const justifications = jusSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const LAST = metaSnap.data().lastAutoProcessedWeekId

// Full session map (every week) — the simulation only reads window weeks anyway.
const sessionsByUserWeek = {}
for (const w of workouts) ((sessionsByUserWeek[w.userId] ??= {})[w.weekId] = (sessionsByUserWeek[w.userId]?.[w.weekId] || 0) + 1)

// Zero state. Absences start ACTIVE with settlement fields stripped.
const users = Object.fromEntries(USER_IDS.map((id) => [id, {
  id, walletBalance: 0, currentFineLevel: BASE_FINE, consecutiveMisses: 0, consecutiveSuccesses: 0,
  extraLives: 0, hasShield: false, bankedExtras: 0,
}]))
const absences = actualAbsences.map(({ status, closedAt, debtUnpaid, fineApplied, totalDebt, ...rest }) => ({ ...rest, status: 'active' }))
const summaries = {} // `${uid}_${wk}` → merged doc

const weeks = []
for (let wk = FROM; ; wk = getNextWeekId(wk)) { weeks.push(wk); if (wk === LAST || weeks.length > 120) break }

const SUM_FIELDS = ['status', 'sessions', 'totalRequired', 'frozenSessions', 'sessionsJustified', 'fineApplied',
  'debtConsumed', 'extrasBanked', 'bankedExtrasAfter', 'debtUnpaid', 'lifeUsed', 'lifeEarned', 'shieldEarned', 'shieldBroken']
const norm = (v) => (v === undefined || v === null ? 0 : v === false ? 0 : v === true ? 1 : v)

for (const wk of weeks) {
  const outcome = computeWeekEndOutcome({
    weekId: wk, userIds: USER_IDS, users: Object.values(users), absences,
    weekWorkouts: workouts.filter((w) => w.weekId === wk),
    weekJustifications: justifications.filter((j) => j.weekId === wk),
    sessionsByUserWeek, nowIso: `replay:${wk}`,
  })
  for (const { userId, data } of outcome.userUpdates) Object.assign(users[userId], data)
  for (const { userId, weekId, data } of outcome.summaries) summaries[`${userId}_${weekId}`] = { ...(summaries[`${userId}_${weekId}`] || {}), ...data }
  for (const { absenceId, data } of outcome.absenceUpdates) Object.assign(absences.find((a) => a.id === absenceId), data)
}

// ── Report: week × user, ideal vs actual ─────────────────────────────────
const fmt = (s) => s ? `${s.status}${s.fineApplied ? `($${s.fineApplied})` : ''}${s.debtConsumed ? ` dc${s.debtConsumed}` : ''}${s.lifeUsed ? ' L-' : ''}${s.lifeEarned ? ' L+' : ''}${s.shieldEarned ? ' S+' : ''}${s.shieldBroken ? ' S-' : ''}` : '(none)'
let summaryDiffs = 0
console.log(`Replay ${weeks[0]} → ${LAST} with CURRENT rules (from zero state)\n`)
for (const wk of weeks) {
  const cells = USER_IDS.map((uid) => {
    const ideal = summaries[`${uid}_${wk}`], actual = actualSummaries[`${uid}_${wk}`]
    const diffs = SUM_FIELDS.filter((f) => norm(ideal?.[f]) !== norm(actual?.[f]))
    if (diffs.length) summaryDiffs++
    const mark = diffs.length ? ' ❌' : ''
    return `${NAMES[uid].padEnd(5)} ideal=${fmt(ideal).padEnd(22)} actual=${fmt(actual)}${mark}${diffs.length ? ` [${diffs.map((f) => `${f}:${JSON.stringify(ideal?.[f] ?? null)}≠${JSON.stringify(actual?.[f] ?? null)}`).join(' ')}]` : ''}`
  })
  const anyDiff = cells.some((c) => c.includes('❌'))
  if (!QUIET || anyDiff) { console.log(wk); for (const c of cells) console.log('   ' + c) }
}

console.log('\n══ USERS: ideal vs actual ══')
const U_FIELDS = ['walletBalance', 'currentFineLevel', 'consecutiveMisses', 'consecutiveSuccesses', 'hasShield', 'extraLives', 'bankedExtras']
for (const uid of USER_IDS) {
  const i = users[uid], a = actualUsers[uid]
  const diffs = U_FIELDS.filter((f) => norm(i[f]) !== norm(a[f]))
  console.log(`${NAMES[uid].padEnd(6)} ${diffs.length ? '❌' : 'OK'} ` + U_FIELDS.map((f) => `${f}=${JSON.stringify(i[f])}${norm(i[f]) !== norm(a[f]) ? `(actual ${JSON.stringify(a[f] ?? null)})` : ''}`).join(' '))
}

console.log('\n══ ABSENCES: ideal vs actual ══')
for (const a of absences) {
  const act = actualAbsences.find((x) => x.id === a.id)
  const fields = ['status', 'debtUnpaid', 'fineApplied', 'totalDebt']
  const diffs = fields.filter((f) => norm(a[f]) !== norm(act[f]))
  console.log(`${NAMES[a.userId].padEnd(6)} ${a.id.slice(0, 6)} ${JSON.stringify(a.frozenWeeks || a.frozenWeekId)} ${diffs.length ? '❌' : 'OK'} ` +
    fields.map((f) => `${f}=${JSON.stringify(a[f] ?? null)}${norm(a[f]) !== norm(act[f]) ? `(actual ${JSON.stringify(act[f] ?? null)})` : ''}`).join(' '))
}
console.log(`\nSummary docs with differences: ${summaryDiffs}`)
process.exit(0)

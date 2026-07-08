// Comprehensive read-only audit of fines + recoveries for ALL users.
// Flags: wallet≠Σfines, frozen/partial summaries with no matching absence
// (deleted "disappeared" absences), active absences whose window already passed,
// settlements inconsistent with their summaries, weeks with workouts but no summary.
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { getAbsenceRecoveryWindow, getFrozenWeeksMap, isLegacyAbsence, computeWeekRequirements } from '../../src/game/absences.js'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com', projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}
const db = getFirestore(initializeApp(firebaseConfig))
const NAMES = { user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' }
const IDS = ['user1', 'user2', 'user3', 'user4']

const [usersSnap, woSnap, absSnap, sumSnap, jusSnap, metaSnap] = await Promise.all([
  getDocs(collection(db, 'users')), getDocs(collection(db, 'workouts')),
  getDocs(collection(db, 'absences')), getDocs(collection(db, 'weekly_summaries')),
  getDocs(collection(db, 'justifications')), getDoc(doc(db, 'settings', 'meta')),
])
const users = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const summaries = sumSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const lastProcessed = metaSnap.data().lastAutoProcessedWeekId

const sessions = {} // uid -> wk -> count
for (const d of woSnap.docs) { const w = d.data(); (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1 }
const sumBy = {} // uid -> wk -> summary
for (const s of summaries) (sumBy[s.userId] ??= {})[s.weekId] = s

const allWeeks = [...new Set(summaries.map((s) => s.weekId).concat(Object.values(sessions).flatMap((m) => Object.keys(m))))].filter(Boolean).sort()
const FLAGS = []

for (const uid of IDS) {
  console.log(`\n═══ ${NAMES[uid]} (${uid}) ═══`)
  const u = users[uid] || {}
  const mySums = summaries.filter((s) => s.userId === uid)
  const sumFines = mySums.reduce((a, s) => a + (s.fineApplied || 0), 0)
  const wallet = u.walletBalance || 0
  const walletOk = wallet === sumFines
  console.log(`wallet=${wallet}  Σsummary-fines=${sumFines}  ${walletOk ? 'OK' : '❌ MISMATCH'}  | fineLvl=${u.currentFineLevel} shield=${u.hasShield} streak=${u.consecutiveSuccesses} misses=${u.consecutiveMisses}`)
  if (!walletOk) FLAGS.push(`${NAMES[uid]}: wallet ${wallet} ≠ Σfines ${sumFines} (diff ${wallet - sumFines})`)

  const myAbs = absences.filter((a) => a.userId === uid)
  console.log('absences:')
  for (const a of myAbs) {
    const win = a.frozenWeeks ? getAbsenceRecoveryWindow(a, absences) : null
    const passed = win && a.status !== 'closed' && win[win.length - 1] < lastProcessed
    console.log(`  ${a.id} status=${a.status ?? '?'} ` +
      (a.frozenWeeks ? `frozenWeeks=${JSON.stringify(a.frozenWeeks)} window→${win[win.length - 1]}` : `LEGACY frozenWeekId=${a.frozenWeekId} recoveryWeeks=${JSON.stringify(a.recoveryWeeks)}`) +
      (a.status === 'closed' ? ` [debtUnpaid=${a.debtUnpaid} fine=${a.fineApplied}]` : '') +
      (passed ? '  ⚠️ ACTIVE but window already passed!' : ''))
    if (passed) FLAGS.push(`${NAMES[uid]}: absence ${a.id} window ended ${win[win.length - 1]} but still active (never settled)`)
  }

  console.log('weeks:')
  for (const wk of allWeeks) {
    const s = sumBy[uid]?.[wk]
    const sess = sessions[uid]?.[wk] || 0
    const req = computeWeekRequirements(uid, wk, absences) // uses CURRENT absences
    // Does any CURRENT absence cover this week (freeze)?
    const frozenNow = absences.filter((a) => a.userId === uid).reduce((n, a) => n + (getFrozenWeeksMap(a)[wk] || 0), 0)
    let flag = ''
    if (s) {
      // Summary claims a freeze/reduced requirement but no absence covers it now → disappeared absence
      if ((s.status === 'frozen' || (s.frozenSessions || 0) > 0) && frozenNow === 0) { flag = '  ⚠️ summary shows freeze but NO absence covers it (deleted?)'; FLAGS.push(`${NAMES[uid]} ${wk}: summary frozenSessions=${s.frozenSessions ?? (s.status === 'frozen' ? '(full)' : 0)} but no current absence covers it`) }
      if ((s.fineApplied || 0) > 0 && s.status !== 'missed') flag += '  ⚠️ fine but status≠missed'
    } else if (sess > 0) {
      flag = '  ⚠️ has workouts but NO summary'
    }
    if (s || sess > 0) {
      console.log(`  ${wk}: sess=${sess} req(now)=${req.totalRequired}${req.frozenSessions ? ` frozen=${req.frozenSessions}` : ''} | summary=${s ? `${s.status}${s.fineApplied ? `($${s.fineApplied})` : ''}${(s.frozenSessions || 0) ? ` fz=${s.frozenSessions}` : ''}${(s.debtUnpaid || 0) ? ` debtUnpaid=${s.debtUnpaid}` : ''}` : '(none)'}${flag}`)
    }
  }
}

console.log('\n\n════════ FLAGS ════════')
if (FLAGS.length === 0) console.log('None — all consistent.')
else FLAGS.forEach((f) => console.log('  ⚠️ ' + f))
process.exit(0)

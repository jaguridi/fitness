// One-off (2026-09-02): the W35 close ran with the old rule that dropped
// PARTIALLY frozen weeks from the recovery window, so a real 4th session done
// in a partially frozen W35 went to bankedExtras instead of paying absence
// debt. Fran (user4) and Gonza (user3) each lost 1 debt payment that way.
// Moves that extra back: bankedExtras 1→0, and the W35 summary gets
// debtConsumed 1 / extrasBanked 0 / bankedExtrasAfter 0.
//
// Dry-run:  node scripts/dev-only/fix-w35-partial-freeze-extras.mjs
// Apply:    node scripts/dev-only/fix-w35-partial-freeze-extras.mjs --apply
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore'
import { simulateAutoRecovery } from '../../src/game/absences.js'

const APPLY = process.argv.includes('--apply')
const WEEK = '2026-W35'
const TARGETS = ['user3', 'user4']
const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com', projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637', appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}
const db = getFirestore(initializeApp(firebaseConfig))

const [absSnap, woSnap] = await Promise.all([getDocs(collection(db, 'absences')), getDocs(collection(db, 'workouts'))])
const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
const sessions = {}
for (const d of woSnap.docs) { const w = d.data(); (sessions[w.userId] ??= {})[w.weekId] = (sessions[w.userId]?.[w.weekId] || 0) + 1 }
const sim = simulateAutoRecovery(absences, sessions) // NEW rule

console.log(APPLY ? '‼️  APPLYING' : '🔎 DRY-RUN')
for (const uid of TARGETS) {
  const userRef = doc(db, 'users', uid)
  const user = (await getDoc(userRef)).data()
  const sumSnap = await getDocs(query(collection(db, 'weekly_summaries'), where('userId', '==', uid), where('weekId', '==', WEEK)))
  if (sumSnap.size !== 1) throw new Error(`${uid}: expected 1 summary for ${WEEK}, got ${sumSnap.size}`)
  const sumDoc = sumSnap.docs[0]
  const s = sumDoc.data()
  const expectedConsumed = sim.debtConsumedByUserWeek[uid]?.[WEEK] || 0

  console.log(`\n${uid} (${user.name}) — summary ${sumDoc.id}`)
  console.log(`  sessions=${s.sessions} frozen=${s.frozenSessions} debtConsumed=${s.debtConsumed} extrasBanked=${s.extrasBanked} bankedExtrasAfter=${s.bankedExtrasAfter} | user.bankedExtras=${user.bankedExtras}`)
  console.log(`  new rule says debtConsumed for ${WEEK} = ${expectedConsumed}`)

  // Guards: only touch the exact state we diagnosed.
  const ok = expectedConsumed === 1 && s.debtConsumed === 0 && s.extrasBanked === 1 && s.bankedExtrasAfter === 1 && user.bankedExtras === 1 && (s.extrasRedeemed || 0) === 0
  if (!ok) { console.log('  ⏭️  state does not match the diagnosed case — skipping'); continue }

  const sumPatch = { debtConsumed: 1, extrasBanked: 0, bankedExtrasAfter: 0 }
  const userPatch = { bankedExtras: 0 }
  console.log(`  → summary ${JSON.stringify(sumPatch)}   user ${JSON.stringify(userPatch)}`)
  if (APPLY) {
    await updateDoc(doc(db, 'weekly_summaries', sumDoc.id), sumPatch)
    await updateDoc(userRef, userPatch)
    console.log('  ✅ written')
  }
}
process.exit(0)

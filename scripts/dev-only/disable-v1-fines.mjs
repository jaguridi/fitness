// Kill switch for the v1 fines game.
//
// Both the v1 Cloud Function (weeklyClose) and every v1 client only settle a
// week when `settings/meta.lastAutoProcessedWeekId` is older than that week.
// Parking the lock at a far-future week id makes all of them skip the close
// forever, so no fine is ever charged again — including from stale cached v1
// PWAs — without deploying anything. The v2 close uses its own lock field.
//
// Usage:
//   node scripts/dev-only/disable-v1-fines.mjs            # disable (idempotent)
//   node scripts/dev-only/disable-v1-fines.mjs --revert   # restore the previous lock
// NOTE: the v2 firestore.rules only let clients set lastAutoProcessedWeekId to
// '9999-W99', so --revert is rejected once they are deployed. Reverting to the
// v1 game means redeploying the v1 rules from tag v1.8.0-multas first.
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, deleteField } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

const PARKED = '9999-W99'
const db = getFirestore(initializeApp(firebaseConfig))
const ref = doc(db, 'settings', 'meta')
const before = (await getDoc(ref)).data() || {}
console.log('before:', before)

if (process.argv.includes('--revert')) {
  if (before.lastAutoProcessedWeekId !== PARKED || !before.v1LastProcessedWeekId) {
    console.log('Lock is not parked (or the previous value is unknown) — nothing to revert.')
  } else {
    await setDoc(ref, {
      lastAutoProcessedWeekId: before.v1LastProcessedWeekId,
      v1LastProcessedWeekId: deleteField(),
      v1FinesDisabledAt: deleteField(),
    }, { merge: true })
  }
} else if (before.lastAutoProcessedWeekId === PARKED) {
  console.log('Already disabled.')
} else {
  await setDoc(ref, {
    lastAutoProcessedWeekId: PARKED,
    v1LastProcessedWeekId: before.lastAutoProcessedWeekId || null,
    v1FinesDisabledAt: new Date().toISOString(),
  }, { merge: true })
}

console.log('after: ', (await getDoc(ref)).data())
process.exit(0)

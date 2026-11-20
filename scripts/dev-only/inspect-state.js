// Read-only inspection of production Firestore v2 state: the two week-close
// locks, each member's weekly goal / rest weeks / streak inputs, habits,
// personal goals and the latest week posts. Never writes.
// Usage: node scripts/dev-only/inspect-state.js [--weeks N]   (default: last 6 weeks of summaries)
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { USER_IDS, V2_START_WEEK, V1_LOCK_PARKED } from '../../src/game/constants.js'
import { getWeekId, getPreviousWeekId } from '../../src/game/weekId.js'
import { getWeeklyGoal, computeMemberWeek } from '../../src/game/week.js'
import { getWeeklyStreak, getBestWeeklyStreak, classifySummary } from '../../src/game/streaks.js'
import { summarizeHabitWeek } from '../../src/game/habits.js'

process.env.TZ = 'America/Santiago'

const firebaseConfig = {
  apiKey: 'AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI',
  authDomain: 'family-fitness-3494e.firebaseapp.com',
  projectId: 'family-fitness-3494e',
  storageBucket: 'family-fitness-3494e.firebasestorage.app',
  messagingSenderId: '546604582637',
  appId: '1:546604582637:web:18e8899628b0c103f8aee4',
}

const weeksArg = process.argv.indexOf('--weeks')
const SHOW_WEEKS = weeksArg >= 0 ? Number(process.argv[weeksArg + 1]) || 6 : 6

const db = getFirestore(initializeApp(firebaseConfig))
const all = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }))

const [users, workouts, summaries, habits, habitWeeks, goals, weekPosts, unlocks] = await Promise.all(
  ['users', 'workouts', 'weekly_summaries', 'habits', 'habit_weeks', 'goals', 'week_posts', 'achievement_unlocks'].map(all))
const metaSnap = await getDoc(doc(db, 'settings', 'meta'))
const meta = metaSnap.exists() ? metaSnap.data() : {}
const currentWeekId = getWeekId()
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

console.log(`Today ${today} · current week ${currentWeekId} · V2_START_WEEK ${V2_START_WEEK}\n`)
console.log('LOCKS (settings/meta)')
const v1 = meta.lastAutoProcessedWeekId
console.log(`  v1 lastAutoProcessedWeekId = ${v1 ?? '(none)'} ${v1 === V1_LOCK_PARKED ? '→ PARKED (no fines can run)' : '→ NOT PARKED: v1 fines would still run!'}`)
if (meta.v1LastProcessedWeekId !== undefined) console.log(`     v1LastProcessedWeekId = ${meta.v1LastProcessedWeekId}`)
const v2 = meta.v2LastClosedWeekId
console.log(`  v2 v2LastClosedWeekId    = ${v2 ?? `(none → counts as ${getPreviousWeekId(V2_START_WEEK)})`}`)
console.log(`     v2Processing          = ${meta.v2Processing ? JSON.stringify({ weekId: meta.v2Processing.weekId }) : '(none)'}`)
if (meta.processing) console.log(`     (stale v1 processing claim: ${JSON.stringify({ weekId: meta.processing.weekId })})`)

console.log('\nMEMBERS')
for (const id of USER_IDS) {
  const u = users.find((x) => x.id === id) || { id }
  const mine = summaries.filter((s) => s.userId === id)
  const week = computeMemberWeek({ user: u, weekId: currentWeekId, workouts, currentWeekId, today })
  const streak = getWeeklyStreak(mine, { beforeWeekId: currentWeekId, currentWeekMet: week.met })
  const tokens = new Set([...(u.fcmTokens || []), u.fcmToken].filter(Boolean)).size
  console.log(`  ${id} (${u.name ?? '?'}): weeklyGoal=${getWeeklyGoal(u)}${u.weeklyGoal == null ? ' (default)' : ''}` +
    ` restWeeks=${JSON.stringify(u.restWeeks || [])} habitReminder=${u.prefs?.habitReminder !== false}` +
    ` pushDevices=${tokens} v2SeededAt=${u.v2SeededAt ? 'yes' : 'no'}`)
  console.log(`     this week: ${week.sessions}/${week.goal} ${week.status} · streak=${streak} best=${getBestWeeklyStreak(mine)}`)
  const recent = mine.filter((s) => s.weekId).sort((a, b) => a.weekId.localeCompare(b.weekId)).slice(-SHOW_WEEKS)
  console.log(`     last ${recent.length} summaries: ${recent.map((s) => `${s.weekId}=${s.status}${s.v === 2 ? '' : '(v1)'}[${classifySummary(s)[0]}]`).join(' ')}`)

  const myHabits = habits.filter((h) => h.userId === id)
  if (myHabits.length) {
    const hw = habitWeeks.find((x) => x.userId === id && x.weekId === currentWeekId) || null
    const hs = summarizeHabitWeek(myHabits, hw, currentWeekId)
    console.log(`     habits (${myHabits.length}, ${myHabits.filter((h) => h.archived).length} archived): ` +
      hs.items.map((i) => `${i.emoji}${i.name} ${i.done}/${i.target}`).join(', ') + ` · met ${hs.met}/${hs.total}`)
  }
  const myGoals = goals.filter((g) => g.userId === id)
  for (const g of myGoals) {
    console.log(`     goal ${g.id}: ${g.emoji ?? ''}${g.title} [${g.status}] ${g.kind}/${g.metric ?? g.unit ?? ''} target=${g.target}` +
      ` ${g.startDate}→${g.endDate} ${g.visibility ?? 'family'}${g.reward ? ` reward="${g.reward}"` : ''}`)
  }
  const myUnlocks = unlocks.filter((x) => x.userId === id)
  console.log(`     stickers: ${myUnlocks.length} (${myUnlocks.filter((x) => x.seeded).length} seeded)`)
}

console.log(`\nWEEK POSTS (${weekPosts.length})`)
for (const p of weekPosts.sort((a, b) => a.id.localeCompare(b.id)).slice(-SHOW_WEEKS)) {
  const results = (p.results || []).map((r) => `${r.userId}=${r.status} ${r.sessions}/${r.goal} streak=${r.streak}`).join(' · ')
  console.log(`  ${p.id}: ${results}`)
  console.log(`     recap=${p.recap ? 'yes' : 'no'} resultsPushed=${p.resultsPushedAt ? 'yes' : 'no'}` +
    ` reactions=${Object.keys(p.reactions || {}).length} comments=${(p.comments || []).length}`)
}

process.exit(0)

// Recap generation + caching (weekly_recaps/{weekId}, monthly_recaps/{monthId},
// and week_posts/{weekId}.recap). Firestore and the OpenAI client are
// injected; nothing here initializes Firebase on import.

import {
  buildWeeklyRecapInput, weeklyRecapText, WEEKLY_SYSTEM_PROMPT,
  buildMonthlyRecapInput, monthlyRecapText, MONTHLY_SYSTEM_PROMPT,
  completeRecap,
} from './recaps.js'
import { getCollection } from './store.js'

export class RecapNotFound extends Error {
  constructor(message) {
    super(message)
    this.code = 'not-found'
  }
}

/** Copy a recap into week_posts/{weekId}.recap when that post exists and lacks it. */
export async function mirrorRecapToWeekPost(db, weekId, recap) {
  if (!recap) return false
  const ref = db.collection('week_posts').doc(weekId)
  const snap = await ref.get()
  if (!snap.exists || snap.data().recap === recap) return false
  await ref.update({ recap })
  return true
}

/**
 * Cached weekly recap, generating it when missing.
 * @param {{ db, makeClient: () => object, weekId: string }} p
 * @returns {Promise<{ weekId, recap, summaries, createdAt }>}
 */
export async function getOrCreateWeeklyRecap({ db, makeClient, weekId }) {
  const ref = db.collection('weekly_recaps').doc(weekId)
  const existing = await ref.get()
  if (existing.exists && existing.data().recap) {
    await mirrorRecapToWeekPost(db, weekId, existing.data().recap)
    return existing.data()
  }

  const [users, summaries, unlocks, goals] = await Promise.all(
    ['users', 'weekly_summaries', 'achievement_unlocks', 'goals'].map((c) => getCollection(db, c)))
  const people = buildWeeklyRecapInput({ weekId, users, summaries, unlocks, goals })
  if (people.length === 0) throw new RecapNotFound('No hay resúmenes para esta semana.')

  const recap = await completeRecap(makeClient(), {
    system: WEEKLY_SYSTEM_PROMPT,
    user: weeklyRecapText(weekId, people),
    people,
    names: users.map((u) => u.name).filter(Boolean),
  })
  const recapData = { weekId, recap, summaries: people, createdAt: new Date() }
  await ref.set(recapData)
  await mirrorRecapToWeekPost(db, weekId, recap)
  return recapData
}

/**
 * Cached monthly recap ('yyyy-MM'), generating it when missing.
 * @returns {Promise<{ monthId, monthLabel, recap, perUser, totals, createdAt }>}
 */
export async function getOrCreateMonthlyRecap({ db, makeClient, monthId }) {
  const ref = db.collection('monthly_recaps').doc(monthId)
  const existing = await ref.get()
  if (existing.exists && existing.data().recap) return existing.data()

  const [users, summaries, workouts, habitWeeks, habits, unlocks, goals] = await Promise.all(
    ['users', 'weekly_summaries', 'workouts', 'habit_weeks', 'habits', 'achievement_unlocks', 'goals']
      .map((c) => getCollection(db, c)))
  const input = buildMonthlyRecapInput({ monthId, users, summaries, workouts, habitWeeks, habits, unlocks, goals })
  if (input.perUser.length === 0) throw new RecapNotFound('No hay datos para este mes.')

  const recap = await completeRecap(makeClient(), {
    system: MONTHLY_SYSTEM_PROMPT,
    user: monthlyRecapText(input),
    people: input.perUser,
    names: users.map((u) => u.name).filter(Boolean),
  })
  const recapData = {
    monthId,
    monthLabel: input.label,
    recap,
    perUser: input.perUser,
    totals: input.totals,
    createdAt: new Date(),
  }
  await ref.set(recapData)
  return recapData
}

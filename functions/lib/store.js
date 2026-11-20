// Firestore implementation of the week-close store (see ./weekClose.js) plus
// the small read helpers the functions share. Mirrors the client's writes in
// src/data/backend.firebase.js (claimWeekProcessing, completeWeekProcessing,
// parkV1FinesLock, setWeeklySummary, setWeekPost, markGoalMissed).
//
// `db` is an Admin SDK Firestore and `FieldValue` its FieldValue class, both
// injected so this module never initializes Firebase on import.

import { V2_START_WEEK, V1_LOCK_PARKED } from '../game/constants.js'
import { getPreviousWeekId } from '../game/weekId.js'

export const CLAIM_TTL_MS = 5 * 60 * 1000
const v2Last = (meta) => meta.v2LastClosedWeekId || getPreviousWeekId(V2_START_WEEK)
const withId = (d) => ({ id: d.id, ...d.data() })

export async function getCollection(db, name) {
  const snap = await db.collection(name).get()
  return snap.docs.map(withId)
}

export function createFirestoreStore(db, FieldValue) {
  const metaRef = () => db.collection('settings').doc('meta')

  return {
    async getMeta() {
      const snap = await metaRef().get()
      return snap.exists ? snap.data() : {}
    },

    /** Park the v1 lock at '9999-W99' unless already parked. */
    parkV1Lock() {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(metaRef())
        const meta = snap.exists ? snap.data() : {}
        if (meta.lastAutoProcessedWeekId === V1_LOCK_PARKED) return false
        tx.set(metaRef(), {
          lastAutoProcessedWeekId: V1_LOCK_PARKED,
          v1LastProcessedWeekId: meta.lastAutoProcessedWeekId ?? null,
          v1FinesDisabledAt: FieldValue.serverTimestamp(),
        }, { merge: true })
        return true
      })
    },

    claimWeek(weekId) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(metaRef())
        const meta = snap.exists ? snap.data() : {}
        if (v2Last(meta) >= weekId) return false
        const p = meta.v2Processing
        const startedAt = p?.startedAt?.toMillis?.() ?? 0
        if (p?.weekId === weekId && Date.now() - startedAt < CLAIM_TTL_MS) return false
        tx.set(metaRef(), { v2Processing: { weekId, startedAt: FieldValue.serverTimestamp() } }, { merge: true })
        return true
      })
    },

    async completeWeek(weekId) {
      await metaRef().set({ v2LastClosedWeekId: weekId, v2Processing: FieldValue.delete() }, { merge: true })
    },

    async loadInputs() {
      const [users, workouts, habits, habitWeeks, summaries, goals] = await Promise.all(
        ['users', 'workouts', 'habits', 'habit_weeks', 'weekly_summaries', 'goals'].map((c) => getCollection(db, c)))
      return { users, workouts, habits, habitWeeks, summaries, goals }
    },

    async writeSummary(userId, weekId, data) {
      await db.collection('weekly_summaries').doc(`${userId}_${weekId}`)
        .set({ ...data, userId, weekId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    },

    /** Merge week_posts/{weekId}; never touches reactions/comments; createdAt only on first write. */
    writeWeekPost(weekId, data) {
      const { reactions, comments, createdAt, ...rest } = data // eslint-disable-line no-unused-vars
      return db.runTransaction(async (tx) => {
        const ref = db.collection('week_posts').doc(weekId)
        const exists = (await tx.get(ref)).exists
        tx.set(ref, {
          ...rest,
          weekId,
          updatedAt: FieldValue.serverTimestamp(),
          ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true })
      })
    },

    /** status → 'missed', only if the goal is still active. */
    markGoalMissed(goalId) {
      return db.runTransaction(async (tx) => {
        const ref = db.collection('goals').doc(goalId)
        const snap = await tx.get(ref)
        if (!snap.exists || (snap.data().status || 'active') !== 'active') return false
        tx.update(ref, { status: 'missed' })
        return true
      })
    },

    /**
     * Claim the "results pushed" marker on week_posts/{weekId} so each closed
     * week's personal result pushes go out exactly once, whoever closed it.
     * False when the post doesn't exist or the results were already sent.
     */
    claimResultsPush(weekId) {
      return db.runTransaction(async (tx) => {
        const ref = db.collection('week_posts').doc(weekId)
        const snap = await tx.get(ref)
        if (!snap.exists || snap.data().resultsPushedAt) return false
        tx.update(ref, { resultsPushedAt: FieldValue.serverTimestamp() })
        return true
      })
    },

    async getWeekPost(weekId) {
      const snap = await db.collection('week_posts').doc(weekId).get()
      return snap.exists ? snap.data() : null
    },
  }
}

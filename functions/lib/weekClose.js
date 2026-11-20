// v2 weekly close orchestration — pure apart from the injected `store`, so it
// can be tested offline with a fake. Mirrors the client fallback in
// src/data/weekClose.js EXACTLY (same lock, same order of writes, same
// in-memory carry-over between weeks); keep both in sync.
//
// The store (see ./store.js for the Firestore implementation):
//   parkV1Lock()                 → Promise<boolean>   park lastAutoProcessedWeekId at '9999-W99'
//   getMeta()                    → Promise<object>    settings/meta
//   claimWeek(weekId)            → Promise<boolean>   v2Processing claim (false = someone else / already closed)
//   completeWeek(weekId)         → Promise<void>      v2LastClosedWeekId = weekId, drop v2Processing
//   loadInputs()                 → Promise<{ users, workouts, habits, habitWeeks, summaries, goals }>
//   writeSummary(userId, weekId, data) → Promise<void>  weekly_summaries/{userId}_{weekId} (merge)
//   writeWeekPost(weekId, data)  → Promise<void>      week_posts/{weekId} (merge, keeps reactions/comments/createdAt)
//   markGoalMissed(goalId)       → Promise<boolean>   only if still 'active'

import { getPreviousWeekId } from '../game/weekId.js'
import { USER_IDS, V2_START_WEEK } from '../game/constants.js'
import { computeWeekClose } from '../game/week.js'
import { weekResultCopy } from './copy.js'

/**
 * Weeks to close, oldest first: every week after `lastClosed` (default: the
 * week before V2_START_WEEK) up to the week before `currentWeekId`. Never more
 * than 52; never a week before V2_START_WEEK.
 * Same function as pendingWeeks() in src/data/weekClose.js.
 */
export function pendingWeeks(lastClosed, currentWeekId) {
  const last = lastClosed || getPreviousWeekId(V2_START_WEEK)
  const prev = getPreviousWeekId(currentWeekId)
  if (last >= prev) return []
  const pending = []
  let cursor = prev
  for (let i = 0; i < 52 && cursor > last; i++) {
    if (cursor >= V2_START_WEEK) pending.unshift(cursor)
    cursor = getPreviousWeekId(cursor)
  }
  return pending
}

/**
 * Park the v1 lock, then close every pending week with the claim protocol.
 * @param {{ store: object, currentWeekId: string, log?: (msg: string) => void }} p
 * @returns {Promise<{ parked: boolean, closed: Array<{ weekId: string, weekPost: object }>, stoppedAt: string|null }>}
 */
export async function runWeeklyClose({ store, currentWeekId, log = () => {} }) {
  const parked = await store.parkV1Lock()
  if (parked) log('weeklyClose: parked the v1 fines lock')

  const meta = await store.getMeta()
  const weeks = pendingWeeks(meta.v2LastClosedWeekId, currentWeekId)
  const closed = []
  if (!weeks.length) return { parked, closed, stoppedAt: null }

  const inputs = await store.loadInputs()
  const { users, workouts, habits, habitWeeks } = inputs
  let history = inputs.summaries || []
  let liveGoals = inputs.goals || []

  for (const weekId of weeks) {
    // Someone else (a client, or an overlapping run) owns this week: later
    // weeks depend on it, so stop here and let the next run continue.
    if (!(await store.claimWeek(weekId))) {
      log(`weeklyClose: ${weekId} already closed or claimed elsewhere, stopping`)
      return { parked, closed, stoppedAt: weekId }
    }
    const out = computeWeekClose({ weekId, userIds: USER_IDS, users, workouts, habits, habitWeeks, summaries: history, goals: liveGoals })
    for (const s of out.summaries) await store.writeSummary(s.userId, s.weekId, s.data)
    await store.writeWeekPost(weekId, out.weekPost.data)
    for (const { goalId } of out.goalUpdates) await store.markGoalMissed(goalId)
    const missed = new Set(out.goalUpdates.map((u) => u.goalId))
    liveGoals = liveGoals.map((g) => (missed.has(g.id) ? { ...g, status: 'missed' } : g))
    history = [...history.filter((s) => s.weekId !== weekId), ...out.summaries.map((s) => s.data)]
    await store.completeWeek(weekId)
    closed.push({ weekId, weekPost: out.weekPost.data })
    log(`weeklyClose: closed ${weekId}`)
  }
  return { parked, closed, stoppedAt: null }
}

/**
 * Personal result pushes for one closed week: one per member in the
 * week post's results. [{ user, copy }]
 */
export function planWeekResultPushes(weekPost, users) {
  const out = []
  for (const result of weekPost?.results || []) {
    const user = (users || []).find((u) => u.id === result.userId)
    if (!user) continue
    out.push({ user, copy: weekResultCopy(user, result) })
  }
  return out
}

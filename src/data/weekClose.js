/**
 * Client fallback for the weekly close (the Cloud Function normally does it
 * on Monday 00:10), plus the v1 fines kill-switch.
 *
 * The v2 close has its own lock in settings/meta: v2LastClosedWeekId +
 * v2Processing (claim protocol in the backend). A missing
 * v2LastClosedWeekId counts as "the week before V2_START_WEEK", so the first
 * run never closes anything older than V2_START_WEEK. Each pending week is
 * claimed, closed with computeWeekClose (weekly_summaries + week_posts +
 * expired goals → 'missed'), then the lock advances.
 */
import { getPreviousWeekId } from '../game/weekId.js'
import { USER_IDS, V2_START_WEEK } from '../game/constants.js'
import { computeWeekClose } from '../game/week.js'

/**
 * Weeks the client should try to close, oldest first: every week after
 * `lastClosed` (default: the week before V2_START_WEEK) up to the previous
 * week. Never more than 52 weeks; never weeks before V2_START_WEEK.
 * @param {string|undefined} lastClosed  meta.v2LastClosedWeekId
 * @param {string} currentWeekId
 * @returns {string[]}
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
 * Run the fallback close.
 * @param {import('./index.js').Backend} backend
 * @param {{ currentWeekId: string, users: object[], workouts: object[], habits: object[],
 *   habitWeeks: object[], summaries: object[], goals?: object[] }} data  current snapshot
 * @returns {Promise<string[]>} the weeks this client closed
 */
export async function runClientWeekClose(backend, { currentWeekId, users, workouts, habits, habitWeeks, summaries, goals = [] }) {
  const meta = await backend.getAppMeta()
  const weeks = pendingWeeks(meta.v2LastClosedWeekId, currentWeekId)
  let history = summaries || []
  let liveGoals = goals
  const processed = []
  for (const weekId of weeks) {
    // Someone else (another device or the Cloud Function) owns this week:
    // later weeks depend on it, so stop and let the next load continue.
    if (!(await backend.claimWeekProcessing(weekId))) break
    const out = computeWeekClose({ weekId, userIds: USER_IDS, users, workouts, habits, habitWeeks, summaries: history, goals: liveGoals })
    for (const s of out.summaries) await backend.setWeeklySummary(s.userId, s.weekId, s.data)
    await backend.setWeekPost(weekId, out.weekPost.data)
    for (const { goalId } of out.goalUpdates) await backend.markGoalMissed(goalId)
    const missed = new Set(out.goalUpdates.map((u) => u.goalId))
    liveGoals = liveGoals.map((g) => (missed.has(g.id) ? { ...g, status: 'missed' } : g))
    history = [...history.filter((s) => s.weekId !== weekId), ...out.summaries.map((s) => s.data)]
    await backend.completeWeekProcessing(weekId)
    processed.push(weekId)
  }
  return processed
}

/**
 * Kill-switch for v1 fines: park settings/meta.lastAutoProcessedWeekId at
 * '9999-W99' (the backend keeps the old value in v1LastProcessedWeekId).
 * A no-op in read-only mode; in-memory in demo mode.
 * @returns {Promise<boolean>} true when it changed something
 */
export function parkV1Lock(backend) {
  return backend.parkV1FinesLock()
}

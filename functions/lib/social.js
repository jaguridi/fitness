// Social push decisions — pure (no Firebase imports). Each planner takes the
// trigger's before/after docs plus the users list and returns
// [{ user, copy }] (recipients never include the actor).
//
// Privacy: private goals (visibility 'private') never produce pushes to
// anyone else. Habits never produce social pushes. Seeded achievement unlocks
// (historical stickers registered silently on first v2 load) never push.

import {
  workoutCreatedCopy, commentCopy, reactionCopy, weekPostCommentCopy,
  unlockCopy, goalCreatedCopy, goalAchievedCopy,
} from './copy.js'

const byId = (users, id) => (users || []).find((u) => u.id === id)
const isFamilyVisible = (doc) => (doc?.visibility || 'family') === 'family'
const commentKey = (c) => `${c?.userId}|${c?.createdAt?.toMillis?.() ?? c?.createdAt}|${c?.text}`

/** Comments present in `after` but not in `before` (arrayUnion appends). */
export function newComments(before, after) {
  const seen = new Set((before?.comments || []).map(commentKey))
  return (after?.comments || []).filter((c) => c?.userId && !seen.has(commentKey(c)))
}

/** Reactions added or changed between `before` and `after`: [{ userId, emoji }]. */
export function newReactions(before, after) {
  const prev = before?.reactions || {}
  return Object.entries(after?.reactions || {})
    .filter(([uid, emoji]) => emoji && prev[uid] !== emoji)
    .map(([userId, emoji]) => ({ userId, emoji }))
}

/** Workout created → the rest of the family. */
export function planWorkoutCreated(workout, users) {
  if (!workout?.userId) return []
  const owner = byId(users, workout.userId)
  const copy = workoutCreatedCopy(owner, workout)
  return (users || []).filter((u) => u.id !== workout.userId).map((user) => ({ user, copy }))
}

/**
 * New comments / reactions on an item owned by one member → that owner.
 * kind: 'workout' | 'unlock' | 'goal'.
 */
export function planOwnerEngagement(kind, before, after, users) {
  if (!before || !after?.userId) return []
  if (kind === 'goal' && !isFamilyVisible(after)) return []
  const owner = byId(users, after.userId)
  if (!owner) return []
  const out = []
  for (const c of newComments(before, after)) {
    if (c.userId === owner.id) continue
    out.push({ user: owner, copy: commentCopy(kind, byId(users, c.userId), c) })
  }
  for (const r of newReactions(before, after)) {
    if (r.userId === owner.id) continue
    out.push({ user: owner, copy: reactionCopy(kind, byId(users, r.userId), r.emoji, after) })
  }
  return out
}

/**
 * New comment on week_posts/{weekId} → the other members already in that
 * thread (earlier commenters or reactors); when nobody else is in it yet,
 * the rest of the family. Reactions on the week post never push.
 */
export function planWeekPostComments(before, after, users, weekId) {
  if (!before || !after) return []
  const fresh = newComments(before, after)
  if (!fresh.length) return []
  const out = []
  for (const c of fresh) {
    const participants = new Set([
      ...(before.comments || []).map((x) => x?.userId),
      ...Object.keys(after.reactions || {}),
    ].filter((id) => id && id !== c.userId))
    const recipients = participants.size
      ? (users || []).filter((u) => participants.has(u.id))
      : (users || []).filter((u) => u.id !== c.userId)
    const copy = weekPostCommentCopy(byId(users, c.userId), c, weekId)
    for (const user of recipients) out.push({ user, copy })
  }
  return dedupeByUser(out)
}

/** One push per recipient (the latest copy wins) — e.g. two comments in one write. */
function dedupeByUser(list) {
  const map = new Map()
  for (const item of list) map.set(item.user.id, item)
  return [...map.values()]
}

/** achievement_unlocks created (not seeded) → the rest of the family. */
export function planUnlockCreated(unlock, users) {
  if (!unlock?.userId || unlock.seeded) return []
  const owner = byId(users, unlock.userId)
  const copy = unlockCopy(owner, unlock)
  return (users || []).filter((u) => u.id !== unlock.userId).map((user) => ({ user, copy }))
}

/** Family-visible goal created → the rest of the family. */
export function planGoalCreated(goal, users) {
  if (!goal?.userId || !isFamilyVisible(goal)) return []
  if ((goal.status || 'active') !== 'active') return []
  const owner = byId(users, goal.userId)
  const copy = goalCreatedCopy(owner, goal)
  return (users || []).filter((u) => u.id !== goal.userId).map((user) => ({ user, copy }))
}

/** Family-visible goal transitioned to 'achieved' → the rest of the family. */
export function planGoalAchieved(before, after, users) {
  if (!after?.userId || !isFamilyVisible(after)) return []
  if (after.status !== 'achieved' || before?.status === 'achieved') return []
  const owner = byId(users, after.userId)
  const copy = goalAchievedCopy(owner, after)
  return (users || []).filter((u) => u.id !== after.userId).map((user) => ({ user, copy }))
}

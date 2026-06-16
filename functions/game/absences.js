// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Absence + weekly-requirement logic — pure functions shared between the web
// client and Cloud Functions. No I/O, no Firebase imports.
//
// Two absence schemas coexist:
//   - Legacy: { frozenWeekId, frozenSessions, recoveryWeeks, missedSessionsPerRecoveryWeek }
//     User picks recovery weeks manually. recoverySessions ADDS to weekly goal.
//   - New:    { frozenWeeks: { [weekId]: count } }
//     Recovery is automatic: extras above WEEKLY_GOAL in the ±4 ACTIVE weeks
//     around the freeze range pay down debt (FIFO). Weeks frozen by another
//     absence don't count toward the ±4 — the window skips them and extends
//     outward to reach 4 genuinely active weeks on each side. Extras consumed
//     for debt don't count toward EXTRA_LIFE_THRESHOLD.
//
// Both formats are filtered/handled wherever absences are inspected.

import { WEEKLY_GOAL } from './constants.js'
import { getRecoveryWindow } from './weekId.js'

export function isLegacyAbsence(a) {
  return typeof a.frozenWeekId === 'string'
}

export function getFrozenWeeksMap(a) {
  if (a.frozenWeeks && typeof a.frozenWeeks === 'object') return a.frozenWeeks
  if (isLegacyAbsence(a)) {
    const fs = typeof a.frozenSessions === 'number' ? a.frozenSessions : WEEKLY_GOAL
    return { [a.frozenWeekId]: fs }
  }
  return {}
}

export function getAbsenceRange(a) {
  const map = getFrozenWeeksMap(a)
  const keys = Object.keys(map).sort()
  if (keys.length === 0) return null
  return { startWeekId: keys[0], endWeekId: keys[keys.length - 1] }
}

// ±N active weeks of auto-recovery padding on each side of a freeze range.
const RECOVERY_PADDING = 4

/**
 * Weeks frozen by the user's OTHER absences (any status/format) — the weeks an
 * auto-recovery window must skip so a second freeze doesn't count toward the
 * ±4 active-week padding.
 */
function otherFrozenWeeks(a, allAbsences) {
  const skip = new Set()
  if (!allAbsences) return skip
  for (const other of allAbsences) {
    if (other === a || (a.id != null && other.id === a.id)) continue
    if (other.userId !== a.userId) continue
    for (const wk of Object.keys(getFrozenWeeksMap(other))) skip.add(wk)
  }
  return skip
}

export function getAbsenceRecoveryWindow(a, allAbsences = null) {
  const range = getAbsenceRange(a)
  if (!range) return []
  return getRecoveryWindow(
    range.startWeekId, range.endWeekId, RECOVERY_PADDING, otherFrozenWeeks(a, allAbsences)
  )
}

/** createdAt can be a Firestore Timestamp, a plain {seconds} object, or absent. */
function createdAtMillis(a) {
  return a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0
}

/**
 * Greedy FIFO simulation: for each user, walks every active new-format absence
 * in createdAt order, and consumes extras (sessions above WEEKLY_GOAL) from
 * non-frozen weeks in the recovery window to pay down debt.
 *
 * Returns:
 *   {
 *     debtConsumedPerAbsenceWeek: { [absenceId]: { [weekId]: number } },
 *     debtConsumedByUserWeek:    { [userId]: { [weekId]: number } },
 *     remainingDebtByAbsence:    { [absenceId]: number },
 *   }
 */
export function simulateAutoRecovery(absences, sessionsByUserWeek) {
  const debtConsumedPerAbsenceWeek = {}
  const debtConsumedByUserWeek = {}
  const remainingDebtByAbsence = {}

  const newAbsences = absences
    .filter((a) => !isLegacyAbsence(a) && a.status !== 'closed' && a.frozenWeeks)
    .slice()
    .sort((a, b) => createdAtMillis(a) - createdAtMillis(b))

  // Per-week budget of extras already consumed (across absences for the same user/week).
  const extrasConsumedSoFar = {} // `${userId}|${weekId}` → number

  for (const a of newAbsences) {
    const frozenMap = getFrozenWeeksMap(a)
    const totalDebt = Object.values(frozenMap).reduce((s, n) => s + n, 0)
    let remaining = totalDebt
    debtConsumedPerAbsenceWeek[a.id] = {}

    const window = getAbsenceRecoveryWindow(a, absences)
    for (const wk of window) {
      if (remaining <= 0) break
      if (frozenMap[wk] != null) continue // skip the absence's own frozen weeks
      const sessions = sessionsByUserWeek?.[a.userId]?.[wk] || 0
      const totalExtras = Math.max(0, sessions - WEEKLY_GOAL)
      const key = `${a.userId}|${wk}`
      const already = extrasConsumedSoFar[key] || 0
      const available = Math.max(0, totalExtras - already)
      if (available <= 0) continue
      const consume = Math.min(available, remaining)
      remaining -= consume
      debtConsumedPerAbsenceWeek[a.id][wk] = consume
      extrasConsumedSoFar[key] = already + consume
      if (!debtConsumedByUserWeek[a.userId]) debtConsumedByUserWeek[a.userId] = {}
      debtConsumedByUserWeek[a.userId][wk] = (debtConsumedByUserWeek[a.userId][wk] || 0) + consume
    }

    remainingDebtByAbsence[a.id] = remaining
  }

  return { debtConsumedPerAbsenceWeek, debtConsumedByUserWeek, remainingDebtByAbsence }
}

/**
 * Compute the requirements for a user in a given week.
 * Returns { recoverySessions, frozenSessions, totalRequired, fullyFrozen, inRecoveryWindow }
 * - recoverySessions: legacy-only — sessions owed from manually-chosen recovery weeks
 * - frozenSessions: sessions excused from this week (partial freeze allowed)
 * - totalRequired: WEEKLY_GOAL + recovery - frozen (clamped to 0)
 * - fullyFrozen: true when frozenSessions covers the entire (goal+recovery)
 * - inRecoveryWindow: true if any active new-format absence has this week in its ±4 window
 */
export function computeWeekRequirements(userId, weekId, absences) {
  // Legacy recovery sessions add to the goal
  const recoverySessions = absences
    .filter((a) => a.userId === userId && isLegacyAbsence(a) && a.recoveryWeeks?.includes(weekId))
    .reduce((sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[weekId] || 0), 0)

  // Sum frozen sessions across both formats
  const frozenSessions = absences
    .filter((a) => a.userId === userId)
    .reduce((sum, a) => sum + (getFrozenWeeksMap(a)[weekId] || 0), 0)

  // Active new-format absence that has this week in its recovery window?
  const inRecoveryWindow = absences.some((a) =>
    a.userId === userId && !isLegacyAbsence(a) && a.status !== 'closed' &&
    getAbsenceRecoveryWindow(a, absences).includes(weekId)
  )

  const baseGoal = WEEKLY_GOAL + recoverySessions
  const fullyFrozen = frozenSessions >= baseGoal
  const totalRequired = Math.max(0, baseGoal - frozenSessions)

  return { recoverySessions, frozenSessions, totalRequired, fullyFrozen, inRecoveryWindow }
}

/**
 * Compute total sessions justified by approved/pending justifications for a user/week.
 * Backwards compat: legacy justifications without sessionsJustified field = WEEKLY_GOAL (full week).
 */
export function computeSessionsJustified(userId, weekId, justifications) {
  return justifications
    .filter((j) => j.userId === userId && j.weekId === weekId &&
      (j.aiVerdict === true || j.status === 'pending_vote'))
    .reduce((sum, j) => {
      const sj = typeof j.sessionsJustified === 'number' ? j.sessionsJustified : WEEKLY_GOAL
      return sum + sj
    }, 0)
}

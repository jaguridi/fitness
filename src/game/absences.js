// Absence + weekly-requirement logic — pure functions shared between the web
// client and Cloud Functions. No I/O, no Firebase imports.
//
// Two absence schemas coexist:
//   - Legacy: { frozenWeekId, frozenSessions, recoveryWeeks, missedSessionsPerRecoveryWeek }
//     User picks recovery weeks manually. recoverySessions ADDS to weekly goal.
//   - New:    { frozenWeeks: { [weekId]: count } }
//     Recovery is automatic: EXTRAS in the ±4 ACTIVE weeks around the freeze
//     range pay down debt (FIFO by absence creation). An extra is any session
//     above what that week actually REQUIRED (WEEKLY_GOAL minus the sessions
//     frozen there, plus legacy recovery) — so in a week where 1 session was
//     frozen, the 3rd session is already an extra and repays the freeze itself.
//     Freezing and then training anyway is therefore neutral: it never leaves
//     debt behind that a full week of training wouldn't also have left.
//     Weeks frozen by ANOTHER absence don't count toward the ±4 — the window
//     extends outward to reach 4 genuinely active weeks on each side. Weeks
//     FULLY frozen by another absence (≥ WEEKLY_GOAL sessions) are dropped from
//     the window; PARTIALLY frozen weeks stay in it. An absence's OWN frozen
//     weeks are in its window too: sessions done there (required = 0 when fully
//     frozen) repay that same absence.
//     Extras consumed for debt don't count toward EXTRA_LIFE_THRESHOLD.
//     An optional `extraRecoveryWeeks: N` grants that absence N more ACTIVE
//     weeks at the END of its window — a one-off deadline extension.
//
// Both formats are filtered/handled wherever absences are inspected.

import { WEEKLY_GOAL } from './constants.js'
import { getRecoveryWindow } from './weekId.js'
import { HOLIDAY_WEEKS, getHoliday } from './holidays.js'

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
 * One-off deadline extension stored on the absence doc: N extra ACTIVE weeks
 * added to the TRAILING padding only, so the absence gets more time to pay
 * without also reaching further back to claim older extras.
 *
 * Lives on the data, not in RECOVERY_PADDING, so the standing ±4 rule keeps
 * applying to every other (and every future) absence.
 */
function extraRecoveryWeeks(a) {
  const n = a.extraRecoveryWeeks
  return typeof n === 'number' && n > 0 ? Math.floor(n) : 0
}

/**
 * Sessions frozen per week for one user, summed across the given absences
 * (any status/format). `{ [weekId]: count }`.
 */
function frozenTotalsByWeek(userId, absences) {
  const totals = {}
  for (const a of absences || []) {
    if (a.userId !== userId) continue
    for (const [wk, n] of Object.entries(getFrozenWeeksMap(a))) totals[wk] = (totals[wk] || 0) + n
  }
  return totals
}

/**
 * Weeks frozen by the user's OTHER absences, split by how much is frozen.
 * Neither kind counts toward the ±4 active-week padding, so a second freeze
 * never eats an absence's recovery time. `full` weeks (≥ WEEKLY_GOAL frozen)
 * are dropped from the window entirely; `partial` ones stay in it because the
 * user can still do a real extra there.
 */
function otherFrozenWeeks(a, allAbsences) {
  const full = new Set()
  const partial = new Set()
  if (!allAbsences) return { full, partial }
  const others = allAbsences.filter((o) => !(o === a || (a.id != null && o.id === a.id)))
  for (const [wk, n] of Object.entries(frozenTotalsByWeek(a.userId, others))) {
    if (n >= WEEKLY_GOAL) full.add(wk)
    else partial.add(wk)
  }
  return { full, partial }
}

export function getAbsenceRecoveryWindow(a, allAbsences = null) {
  const range = getAbsenceRange(a)
  if (!range) return []
  const { full, partial } = otherFrozenWeeks(a, allAbsences)
  // An agreed holiday is an optional recovery opportunity, but does not use
  // up one of the active weeks available to repay an absence.
  for (const wk of Object.keys(HOLIDAY_WEEKS)) {
    full.delete(wk)
    partial.add(wk)
  }
  return getRecoveryWindow(
    range.startWeekId, range.endWeekId, RECOVERY_PADDING, full,
    RECOVERY_PADDING + extraRecoveryWeeks(a), partial
  )
}

/** createdAt can be a Firestore Timestamp, a plain {seconds} object, or absent. */
function createdAtMillis(a) {
  return a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0
}

/**
 * Legacy-format recovery sessions manually scheduled onto `weekId` (they ADD to
 * the weekly goal). New-format absences never contribute here.
 */
function legacyRecoverySessions(userId, weekId, absences) {
  return absences
    .filter((a) => a.userId === userId && isLegacyAbsence(a) && a.recoveryWeeks?.includes(weekId))
    .reduce((sum, a) => sum + (a.missedSessionsPerRecoveryWeek?.[weekId] || 0), 0)
}

/**
 * Sessions a week actually demands from the user once freezes are applied:
 * WEEKLY_GOAL + legacy recovery − frozen (clamped at 0). Anything logged above
 * this is an EXTRA that can pay recovery debt. Same arithmetic as
 * computeWeekRequirements().totalRequired, exposed so the simulation and the
 * UI can't drift apart.
 */
export function requiredSessionsForWeek(userId, weekId, absences, frozenTotals = null) {
  if (getHoliday(weekId)) return 0
  const frozen = frozenTotals
    ? (frozenTotals[weekId] || 0)
    : (frozenTotalsByWeek(userId, absences)[weekId] || 0)
  return Math.max(0, WEEKLY_GOAL + legacyRecoverySessions(userId, weekId, absences) - frozen)
}

/**
 * Greedy FIFO simulation: for each user, walks every new-format absence in
 * createdAt order, and consumes extras — sessions above what each week
 * REQUIRED after freezes (see requiredSessionsForWeek) — from the weeks in the
 * recovery window to pay down debt.
 *
 * Because the requirement already discounts frozen sessions, a partially (or
 * fully) frozen week repays its own freeze first: freeze 1 and still train 3
 * times → 1 extra → the frozen session is paid back, exactly as if the freeze
 * had never happened. Weeks fully frozen by a DIFFERENT absence are not in the
 * window at all (see getAbsenceRecoveryWindow).
 *
 * CLOSED absences are included so the extras they already consumed stay
 * reserved — otherwise a still-active absence would reuse the same sessions and
 * a real recovery debt would silently vanish. Callers act only on active
 * absences' remaining debt (they filter by status); closed ones just hold their
 * claim on past extras.
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
    .filter((a) => !isLegacyAbsence(a) && a.frozenWeeks)
    .slice()
    .sort((a, b) => createdAtMillis(a) - createdAtMillis(b))

  // Per-week budget of extras already consumed (across absences for the same user/week).
  const extrasConsumedSoFar = {} // `${userId}|${weekId}` → number
  // Per-user frozen sessions per week, across ALL their absences.
  const frozenTotalsByUser = {}

  for (const a of newAbsences) {
    const frozenMap = getFrozenWeeksMap(a)
    const totalDebt = Object.values(frozenMap).reduce((s, n) => s + n, 0)
    let remaining = totalDebt
    debtConsumedPerAbsenceWeek[a.id] = {}
    const frozenTotals = frozenTotalsByUser[a.userId] ??= frozenTotalsByWeek(a.userId, absences)

    const window = getAbsenceRecoveryWindow(a, absences)
    for (const wk of window) {
      if (remaining <= 0) break
      const sessions = sessionsByUserWeek?.[a.userId]?.[wk] || 0
      // Extras are counted above the week's REAL requirement (goal minus frozen),
      // so a session that "covers" a frozen one repays the freeze right there.
      const required = requiredSessionsForWeek(a.userId, wk, absences, frozenTotals)
      const totalExtras = Math.max(0, sessions - required)
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
  const recoverySessions = legacyRecoverySessions(userId, weekId, absences)

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
  const holiday = getHoliday(weekId)
  if (holiday) {
    return { recoverySessions: 0, frozenSessions: 0, totalRequired: 0,
      fullyFrozen: true, inRecoveryWindow, holiday: holiday.name }
  }
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

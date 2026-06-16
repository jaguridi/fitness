// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Week-end settlement — the financial core of the game, as a pure function.
// Shared between the web client (src/hooks/useGameLogic.js) and Cloud
// Functions (functions/index.js). No I/O: callers fetch the inputs, apply the
// returned operations to Firestore in order, and persist the lock themselves.

import {
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  EXTRAS_PER_FINE_REDEMPTION,
  FINE_REDEMPTION_AMOUNT,
} from './constants.js'
import {
  isLegacyAbsence,
  getFrozenWeeksMap,
  getAbsenceRecoveryWindow,
  simulateAutoRecovery,
  computeWeekRequirements,
  computeSessionsJustified,
} from './absences.js'

/**
 * Compute everything the week-end close must write, without writing it.
 *
 * @param {object} input
 * @param {string}   input.weekId             week being closed
 * @param {string[]} input.userIds            processing order (the 4 family ids)
 * @param {object[]} input.users              Firestore user docs ({ id, ... })
 * @param {object[]} input.absences           all absence docs
 * @param {object[]} input.weekWorkouts       workouts with weekId === input.weekId
 * @param {object[]} input.weekJustifications justifications for the week
 * @param {object}   input.sessionsByUserWeek { [userId]: { [weekId]: count } } across
 *                                            every recovery window touching weekId
 * @param {string}   [input.nowIso]           timestamp used for closedAt
 *
 * @returns {{
 *   userUpdates:    Array<{ userId: string, data: object }>,  // apply in order, merge
 *   summaries:      Array<{ userId: string, weekId: string, data: object }>,
 *   absenceUpdates: Array<{ absenceId: string, data: object }>,
 * }}
 */
export function computeWeekEndOutcome({
  weekId,
  userIds,
  users,
  absences,
  weekWorkouts,
  weekJustifications,
  sessionsByUserWeek,
  nowIso = new Date().toISOString(),
}) {
  const userUpdates = []
  const summaries = []
  const absenceUpdates = []

  const { debtConsumedByUserWeek, remainingDebtByAbsence } =
    simulateAutoRecovery(absences, sessionsByUserWeek)

  // Per-user state updates buffered, so absence settlement below can read the
  // freshest values without a refetch.
  const userStateById = {}
  for (const u of users) userStateById[u.id] = { ...u }

  for (const uid of userIds) {
    const user = userStateById[uid]
    if (!user) continue

    const { recoverySessions, frozenSessions, totalRequired, fullyFrozen } =
      computeWeekRequirements(uid, weekId, absences)

    if (fullyFrozen) {
      summaries.push({
        userId: uid,
        weekId,
        data: {
          status: 'frozen',
          sessions: 0,
          totalRequired: 0,
          recoverySessions,
          frozenSessions,
          fineApplied: 0,
          lifeUsed: false,
          lifeEarned: false,
        },
      })
      continue
    }

    const sessions = weekWorkouts.filter((w) => w.userId === uid).length
    const debtConsumed = debtConsumedByUserWeek[uid]?.[weekId] || 0

    let fineApplied = 0
    let lifeUsed = false
    let lifeEarned = false
    let shieldEarned = false
    let shieldBroken = false
    let newLives = user.extraLives || 0
    let consecutiveMisses = user.consecutiveMisses || 0
    let consecutiveSuccesses = user.consecutiveSuccesses || 0
    let hasShield = user.hasShield || false
    let currentFineLevel = user.currentFineLevel || BASE_FINE

    const deficit = totalRequired - sessions
    const sessionsJustified = computeSessionsJustified(uid, weekId, weekJustifications)
    const effectiveDeficit = Math.max(0, deficit - sessionsJustified)
    const usedJustification = deficit > 0 && sessionsJustified > 0

    if (deficit <= 0) {
      // Goal met without needing justifications
      currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
      consecutiveMisses = 0
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= 4 && !hasShield) {
        hasShield = true
        shieldEarned = true
      }
      // Extras consumed by an absence's debt don't count toward extra life.
      const regularPlusBonus = sessions - recoverySessions - debtConsumed
      if (regularPlusBonus >= EXTRA_LIFE_THRESHOLD) {
        lifeEarned = true
        newLives += 1
      }
    } else if (effectiveDeficit === 0) {
      // Justifications cover the deficit completely → no fine, but streak resets
      consecutiveSuccesses = 0
    } else if (effectiveDeficit === 1 && newLives > 0) {
      // Use a life to cover the last session
      lifeUsed = true
      newLives -= 1
      currentFineLevel = Math.max(BASE_FINE, Math.floor(currentFineLevel / 2))
      consecutiveMisses = 0
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= 4 && !hasShield) {
        hasShield = true
        shieldEarned = true
      }
    } else {
      // Apply fine
      let baseFine = currentFineLevel
      if (hasShield) {
        baseFine = Math.floor(baseFine / 2)
        hasShield = false
        shieldBroken = true
      }
      fineApplied = baseFine
      consecutiveMisses += 1
      consecutiveSuccesses = 0
      currentFineLevel = Math.min(MAX_FINE, currentFineLevel * 2)
    }

    // ── Extras banking + auto-redemption ──────────────────────────────
    // Bankable extras: sessions above WEEKLY_GOAL that weren't consumed by
    // frozen-week debt. Only earned on weeks the goal was met outright (no
    // extras when a fine was applied or justifications/lives covered a miss).
    const weekExtras = (deficit <= 0)
      ? Math.max(0, (sessions - recoverySessions - debtConsumed) - WEEKLY_GOAL)
      : 0

    let walletBalance = (user.walletBalance || 0) + fineApplied
    let bankedExtras = (user.bankedExtras || 0) + weekExtras

    let extrasRedeemed = 0
    let fineReducedByCanje = 0
    while (bankedExtras >= EXTRAS_PER_FINE_REDEMPTION && walletBalance > 0) {
      const reduction = Math.min(FINE_REDEMPTION_AMOUNT, walletBalance)
      walletBalance -= reduction
      bankedExtras -= EXTRAS_PER_FINE_REDEMPTION
      extrasRedeemed += 1
      fineReducedByCanje += reduction
    }

    const newUserState = {
      extraLives: newLives,
      walletBalance,
      bankedExtras,
      currentFineLevel,
      consecutiveMisses,
      consecutiveSuccesses,
      hasShield,
    }
    userStateById[uid] = { ...user, ...newUserState }
    userUpdates.push({ userId: uid, data: newUserState })

    let weekStatus = 'completed'
    if (fineApplied > 0) weekStatus = 'missed'
    else if (usedJustification && deficit > 0) weekStatus = 'justified'

    summaries.push({
      userId: uid,
      weekId,
      data: {
        status: weekStatus,
        sessions,
        totalRequired,
        recoverySessions,
        frozenSessions,
        sessionsJustified,
        fineApplied,
        lifeUsed,
        lifeEarned,
        shieldEarned,
        shieldBroken,
        debtConsumed,
        deficit: Math.max(0, deficit),
        effectiveDeficit,
        extrasBanked: weekExtras,
        extrasRedeemed,
        fineReducedByCanje,
        bankedExtrasAfter: bankedExtras,
      },
    })
  }

  // ── Absence settlement ───────────────────────────────────────────
  // If any new-format absence's recovery window ends on this week and debt
  // remains, apply a proportional fine, escalate, and retroactively mark the
  // frozen weeks as 'missed'.
  for (const a of absences) {
    if (isLegacyAbsence(a) || a.status === 'closed') continue
    const window = getAbsenceRecoveryWindow(a, absences)
    if (window.length === 0 || window[window.length - 1] !== weekId) continue

    const remaining = remainingDebtByAbsence[a.id] || 0
    const frozenMap = getFrozenWeeksMap(a)
    const totalDebt = Object.values(frozenMap).reduce((s, n) => s + n, 0)

    if (remaining > 0) {
      const user = userStateById[a.userId]
      if (user) {
        const fineLevel = user.currentFineLevel || BASE_FINE
        const fine = Math.min(MAX_FINE, Math.round((fineLevel * remaining) / WEEKLY_GOAL))
        const settledState = {
          walletBalance: (user.walletBalance || 0) + fine,
          currentFineLevel: Math.min(MAX_FINE, fineLevel * 2),
          consecutiveMisses: (user.consecutiveMisses || 0) + 1,
          consecutiveSuccesses: 0,
        }
        userStateById[a.userId] = { ...user, ...settledState }
        userUpdates.push({ userId: a.userId, data: settledState })

        // Mark the frozen weeks as 'missed' so history reflects the penalty.
        const frozenWeekIds = Object.keys(frozenMap)
        const finePerWeek = Math.round(fine / Math.max(1, frozenWeekIds.length))
        for (let i = 0; i < frozenWeekIds.length; i++) {
          const fwk = frozenWeekIds[i]
          const share = i === frozenWeekIds.length - 1
            ? fine - finePerWeek * (frozenWeekIds.length - 1)
            : finePerWeek
          summaries.push({
            userId: a.userId,
            weekId: fwk,
            data: {
              status: 'missed',
              fineApplied: share,
              frozenSessions: frozenMap[fwk] || 0,
              debtUnpaid: remaining,
            },
          })
        }

        absenceUpdates.push({
          absenceId: a.id,
          data: {
            status: 'closed',
            debtUnpaid: remaining,
            totalDebt,
            fineApplied: fine,
            closedAt: nowIso,
          },
        })
      }
    } else {
      absenceUpdates.push({
        absenceId: a.id,
        data: {
          status: 'closed',
          debtUnpaid: 0,
          totalDebt,
          fineApplied: 0,
          closedAt: nowIso,
        },
      })
    }
  }

  return { userUpdates, summaries, absenceUpdates }
}

/**
 * Weeks whose session counts the auto-recovery simulation needs in order to
 * close `weekId`: the week itself plus every recovery-window week up to and
 * including it, across all active new-format absences.
 */
export function getSimulationWeeks(weekId, absences) {
  const simWeeks = new Set([weekId])
  for (const a of absences) {
    if (isLegacyAbsence(a) || a.status === 'closed') continue
    for (const w of getAbsenceRecoveryWindow(a, absences)) {
      if (w <= weekId) simWeeks.add(w)
    }
  }
  return [...simWeeks]
}

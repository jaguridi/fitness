/**
 * Pure aggregation for the Archivo page: the closure of season 1 ("la era de
 * las multas") from members' legacy v1 fields and v1 weekly summaries.
 * Tolerates missing fields everywhere; returns `hasData: false` when there is
 * nothing v1 at all (e.g. the demo backend).
 */
import { V2_START_WEEK } from '../../game/constants.js'
import { getWeeksBetween } from '../../game/weekId.js'
import { getBestWeeklyStreak, classifySummary } from '../../game/streaks.js'

/** Statuses shown in the per-member strip, in legend order. */
export const ARCHIVE_STATUSES = ['completed', 'missed', 'justified', 'frozen', 'holiday', 'paused']

/** True for a v1 summary: not written by the v2 close and before the v2 season. */
export function isV1Summary(s) {
  return !!s?.weekId && s.v !== 2 && s.weekId < V2_START_WEEK
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Strip/legend status of one v1 summary ('completed' also covers a week saved with a life). */
export function archiveStatus(s) {
  if (!s) return null
  if (s.lifeUsed) return 'completed'
  return ARCHIVE_STATUSES.includes(s.status) ? s.status : null
}

/**
 * @param {{ members: object[], summaries: object[] }} input
 *   members = useFamily().members (USERS merged with users docs, v1 fields intact)
 * @returns {{
 *   hasData: boolean,
 *   firstWeekId: string|null, lastWeekId: string|null, weekIds: string[],
 *   pot: number, totalSessions: number, weeksAchieved: number,
 *   members: Array<{ id, name, member, fines: number, lives: number|null, shield: boolean|null,
 *     bestStreak: number, sessions: number, achieved: number, missed: number, livesUsed: number,
 *     counts: Record<string, number>, weeks: Array<{ weekId, status: string|null, sessions: number|null,
 *       fine: number, lifeUsed: boolean, holidayName?: string }> }>
 * }}
 */
export function buildArchive({ members = [], summaries = [] } = {}) {
  const v1 = (summaries || []).filter(isV1Summary)
  const sortedIds = [...new Set(v1.map((s) => s.weekId))].sort()
  const firstWeekId = sortedIds[0] || null
  const lastWeekId = sortedIds[sortedIds.length - 1] || null
  let weekIds = []
  if (firstWeekId) {
    try {
      weekIds = getWeeksBetween(firstWeekId, lastWeekId)
    } catch {
      weekIds = sortedIds
    }
    if (!weekIds?.length) weekIds = sortedIds
  }

  const rows = (members || []).map((m) => {
    const mine = v1.filter((s) => s.userId === m.id)
    const byWeek = new Map(mine.map((s) => [s.weekId, s]))
    const counts = Object.fromEntries(ARCHIVE_STATUSES.map((k) => [k, 0]))
    let achieved = 0
    let missed = 0
    let livesUsed = 0
    for (const s of mine) {
      const st = archiveStatus(s)
      if (st) counts[st]++
      if (classifySummary(s) === 'success') achieved++
      else if (s.status === 'missed') missed++
      if (s.lifeUsed) livesUsed++
    }
    const finesFromWeeks = mine.reduce((t, s) => t + num(s.fineApplied), 0)
    const hasWallet = Number.isFinite(Number(m.walletBalance)) && m.walletBalance !== null && m.walletBalance !== ''
    return {
      id: m.id,
      name: m.name,
      member: m,
      // walletBalance is the canonical total (it includes manual corrections).
      fines: hasWallet ? Math.max(0, Number(m.walletBalance)) : finesFromWeeks,
      lives: Number.isFinite(Number(m.extraLives)) && m.extraLives != null ? Number(m.extraLives) : null,
      shield: typeof m.hasShield === 'boolean' ? m.hasShield : null,
      bestStreak: getBestWeeklyStreak(mine),
      sessions: mine.reduce((t, s) => t + num(s.sessions), 0),
      achieved,
      missed,
      livesUsed,
      counts,
      weeks: weekIds.map((weekId) => {
        const s = byWeek.get(weekId)
        return {
          weekId,
          status: archiveStatus(s),
          sessions: s ? num(s.sessions) : null,
          fine: s ? num(s.fineApplied) : 0,
          lifeUsed: !!s?.lifeUsed,
          ...(s?.holidayName ? { holidayName: s.holidayName } : {}),
        }
      }),
    }
  })

  const pot = rows.reduce((t, r) => t + r.fines, 0)
  return {
    hasData: v1.length > 0 || pot > 0,
    firstWeekId,
    lastWeekId,
    weekIds,
    pot,
    totalSessions: rows.reduce((t, r) => t + r.sessions, 0),
    weeksAchieved: rows.reduce((t, r) => t + r.achieved, 0),
    members: rows,
  }
}

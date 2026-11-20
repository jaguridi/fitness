// Scheduled reminder decisions — pure (no Firebase imports). Each planner
// takes the family snapshot and returns [{ user, copy }] for the members who
// should get a push; the caller sends them.
//
// State-aware rules (plan §3 "Notificaciones"):
//   - members on a rest week get no reminders at all;
//   - Monday 09:00: own weekly goal + how many habits they track;
//   - Thursday 09:00: only when clearly behind (2+ sessions still missing);
//   - Sunday 17:00: only while the goal is still open;
//   - daily 20:30: only with prefs.habitReminder !== false and active habits
//     still unchecked today that can still matter this week (a 3-days-a-week
//     habit already met this week is not nagged about).

import { computeMemberWeek, isRestWeek } from '../game/week.js'
import { habitsForWeek, computeHabitWeek, getHabitChecks } from '../game/habits.js'
import { kickoffCopy, midweekCopy, lastCallCopy, habitReminderCopy } from './copy.js'

/** Thursday: remaining sessions at or above this count = "clearly behind". */
export const MIDWEEK_BEHIND_THRESHOLD = 2

const memberHabits = (habits, userId) => (habits || []).filter((h) => h.userId === userId && !h.archived)
const memberHabitWeek = (habitWeeks, userId, weekId) =>
  (habitWeeks || []).find((hw) => hw.userId === userId && hw.weekId === weekId) || null

/** Active (non-archived) habits a member tracks this week. */
export function activeHabitsForWeek(habits, userId, weekId) {
  return habitsForWeek(memberHabits(habits, userId), weekId)
}

function memberWeek(user, weekId, workouts, today) {
  return computeMemberWeek({ user, weekId, workouts, currentWeekId: weekId, closed: false, today })
}

/**
 * @param {{ users: object[], habits?: object[], workouts?: object[], weekId: string, today: string }} p
 * @returns {Array<{ user: object, copy: object }>}
 */
export function planKickoff({ users, habits = [], workouts = [], weekId, today }) {
  const out = []
  for (const user of users || []) {
    if (isRestWeek(user, weekId)) continue
    const week = memberWeek(user, weekId, workouts, today)
    const habitsCount = activeHabitsForWeek(habits, user.id, weekId).length
    out.push({ user, copy: kickoffCopy(user, { goal: week.goal, habitsCount }) })
  }
  return out
}

/** Thursday 09:00: only members clearly behind. */
export function planMidweek({ users, workouts = [], weekId, today }) {
  const out = []
  for (const user of users || []) {
    if (isRestWeek(user, weekId)) continue
    const week = memberWeek(user, weekId, workouts, today)
    if (week.met || week.remaining < MIDWEEK_BEHIND_THRESHOLD) continue
    out.push({ user, copy: midweekCopy(user, week) })
  }
  return out
}

/** Sunday 17:00: only members whose goal is still open. */
export function planLastCall({ users, workouts = [], weekId, today }) {
  const out = []
  for (const user of users || []) {
    if (isRestWeek(user, weekId)) continue
    const week = memberWeek(user, weekId, workouts, today)
    if (week.met || week.remaining <= 0) continue
    out.push({ user, copy: lastCallCopy(user, week) })
  }
  return out
}

/**
 * Habits of one member that deserve a reminder today: active, created by
 * this week, not checked today, and not yet met this week.
 */
export function pendingHabitsToday({ habits, habitWeeks, userId, weekId, today }) {
  const habitWeek = memberHabitWeek(habitWeeks, userId, weekId)
  return activeHabitsForWeek(habits, userId, weekId)
    .filter((h) => !getHabitChecks(habitWeek, h.id).includes(today))
    .filter((h) => !computeHabitWeek(h, habitWeek, weekId).met)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Daily 20:30 habit reminder. */
export function planHabitReminders({ users, habits = [], habitWeeks = [], weekId, today }) {
  const out = []
  for (const user of users || []) {
    if (user?.prefs?.habitReminder === false) continue
    if (isRestWeek(user, weekId)) continue
    const pending = pendingHabitsToday({ habits, habitWeeks, userId: user.id, weekId, today })
    const copy = habitReminderCopy(user, pending)
    if (copy) out.push({ user, copy })
  }
  return out
}

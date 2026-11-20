/**
 * Pure selectors over the FamilyDataProvider state. No React, no I/O — every
 * screen derives what it shows from here.
 *
 * @typedef {object} FamilyState
 * @property {string} weekId     current weekId ('2026-W47')
 * @property {string} today      local 'yyyy-MM-dd'
 * @property {object[]} members  USERS merged with users docs; weeklyGoal defaulted
 * @property {object[]} workouts all workouts (newest first)
 * @property {object[]} summaries all weekly_summaries
 * @property {object[]} habits   all habits
 * @property {object[]} habitWeeks all habit_weeks
 * @property {object[]} unlocks  all achievement_unlocks
 * @property {object[]} weekPosts all week_posts
 * @property {object[]} goals    all personal goals
 */
import { USERS, getAvatarForMood, getWorkoutPoints, getExerciseTypes } from '../constants.js'
import { getPreviousWeekId, getWeekRange } from '../game/weekId.js'
import { computeMemberWeek, getWeeklyGoal, workoutWeekId } from '../game/week.js'
import {
  getWeeklyStreak, getBestWeeklyStreak, getCurrentDayStreak, getBestDayStreak, lastDecidedWeeks, classifySummary,
} from '../game/streaks.js'
import {
  computeHabitWeek, getHabitWeekStreak, getHabitDayStreak, isDailyHabit, summarizeHabitWeek, weekDates, weekdayIndex,
} from '../game/habits.js'
import { ACHIEVEMENTS_BY_ID, ALBUM_PAGES, RARITIES, evaluateAchievements } from '../domain/achievements.js'
import { computeGoalProgress, getGoalState, getGoalDaysLeft, getGoalPace } from '../game/goals.js'
import { toMillis } from '../utils/dates.js'

// ── Per-state indexes (cached per state object) ──────────────

const indexCache = new WeakMap()

function groupBy(list, key) {
  const out = {}
  for (const x of list || []) (out[x[key]] ||= []).push(x)
  return out
}

function index(state) {
  let idx = indexCache.get(state)
  if (!idx) {
    idx = {
      workoutsByUser: groupBy(state.workouts, 'userId'),
      summariesByUser: groupBy(state.summaries, 'userId'),
      habitsByUser: groupBy(state.habits, 'userId'),
      habitWeeksByUser: groupBy(state.habitWeeks, 'userId'),
      unlocksByUser: groupBy(state.unlocks, 'userId'),
      goalsByUser: groupBy(state.goals, 'userId'),
      memo: new Map(),
    }
    indexCache.set(state, idx)
  }
  return idx
}

/** Memoize a computation per state object + key. */
function memo(state, key, fn) {
  const m = index(state).memo
  if (!m.has(key)) m.set(key, fn())
  return m.get(key)
}

const userWorkouts = (state, userId) => index(state).workoutsByUser[userId] || []
const userSummaries = (state, userId) => index(state).summariesByUser[userId] || []
const userHabits = (state, userId) => index(state).habitsByUser[userId] || []
const userHabitWeeks = (state, userId) => index(state).habitWeeksByUser[userId] || []

/** Last `n` weekIds ending at `endWeekId` (oldest first). */
export function lastWeeks(endWeekId, n) {
  const out = [endWeekId]
  while (out.length < n) out.unshift(getPreviousWeekId(out[0]))
  return out
}

// ── Members ──────────────────────────────────────────────────

/**
 * Merge the USERS constants with Firestore users docs (constants win for
 * name/avatar; weeklyGoal is defaulted and clamped).
 * @param {object[]} userDocs
 * @returns {object[]} one entry per USERS member, in USERS order
 */
export function mergeMembers(userDocs) {
  return USERS.map((u) => {
    const d = (userDocs || []).find((x) => x.id === u.id) || {}
    return { ...d, ...u, weeklyGoal: getWeeklyGoal(d), restWeeks: d.restWeeks || [], prefs: { habitReminder: true, ...(d.prefs || {}) } }
  })
}

/**
 * A member (USERS + users doc).
 * @param {FamilyState} state
 * @param {string} userId
 * @returns {object|null}
 */
export function getMember(state, userId) {
  return (state.members || []).find((m) => m.id === userId) || null
}

// ── Weeks ────────────────────────────────────────────────────

/**
 * Mood for the avatar.
 * happy: this week's goal met or weekly streak ≥ 3.
 * sad: the last 2 closed non-neutral weeks were missed and nothing logged this week.
 * @returns {'happy'|'normal'|'sad'}
 */
export function computeMood({ met, streak, sessionsThisWeek, summaries, currentWeekId }) {
  if (met || streak >= 3) return 'happy'
  const last = lastDecidedWeeks(summaries, 2, { beforeWeekId: currentWeekId })
  if (last.length === 2 && last.every((s) => classifySummary(s) === 'break') && sessionsThisWeek === 0) return 'sad'
  return 'normal'
}

/**
 * One member's week: computeMemberWeek() + streak, mood, avatar.
 *
 * For a closed week that has a stored summary, `status`, `goal` and `met`
 * come from the summary (historical truth, including v1 statuses such as
 * 'frozen'); sessions/minutes are always recomputed from workouts.
 *
 * @param {FamilyState} state
 * @param {string} userId
 * @param {string} [weekId=state.weekId]
 * @returns {ReturnType<typeof computeMemberWeek> & {
 *   member: object, summary: object|null, streak: number,
 *   mood: 'happy'|'normal'|'sad', avatar: string, isCurrent: boolean }}
 */
export function getMemberWeek(state, userId, weekId = state.weekId) {
  return memo(state, `mw:${userId}:${weekId}`, () => {
    const member = getMember(state, userId) || { id: userId }
    const week = computeMemberWeek({
      user: member, weekId, workouts: userWorkouts(state, userId), currentWeekId: state.weekId, today: state.today,
    })
    const summaries = userSummaries(state, userId)
    const summary = summaries.find((s) => s.weekId === weekId) || null
    const isCurrent = weekId === state.weekId
    const result = { ...week, member, summary, isCurrent }
    if (week.closed && summary) {
      result.status = summary.status || week.status
      result.goal = summary.goal ?? summary.totalRequired ?? week.goal
      result.met = classifySummary(summary) === 'success'
    }
    result.streak = week.closed
      ? getWeeklyStreak(summaries, { throughWeekId: weekId })
      : getWeeklyStreak(summaries, { beforeWeekId: weekId, currentWeekMet: week.met })
    const current = isCurrent ? week : computeMemberWeek({ user: member, weekId: state.weekId, workouts: userWorkouts(state, userId) })
    const liveStreak = isCurrent ? result.streak : getWeeklyStreak(summaries, { beforeWeekId: state.weekId, currentWeekMet: current.met })
    result.mood = computeMood({
      met: current.met, streak: liveStreak, sessionsThisWeek: current.sessions, summaries, currentWeekId: state.weekId,
    })
    const userConst = USERS.find((u) => u.id === userId)
    result.avatar = getAvatarForMood(userConst, result.mood)
    return result
  })
}

/**
 * The whole family's week.
 * @param {FamilyState} state
 * @param {string} [weekId=state.weekId]
 * @returns {{ weekId, members: object[], completed: number, total: number,
 *   sessions: number, minutes: number, allMet: boolean, post: object|null }}
 */
export function getFamilyWeek(state, weekId = state.weekId) {
  const members = (state.members || []).map((m) => getMemberWeek(state, m.id, weekId))
  const completed = members.filter((m) => m.status === 'completed').length
  return {
    weekId,
    members,
    completed,
    total: members.length,
    sessions: members.reduce((s, m) => s + m.sessions, 0),
    minutes: members.reduce((s, m) => s + m.minutes, 0),
    allMet: members.length > 0 && members.every((m) => m.met || m.status === 'rest'),
    post: (state.weekPosts || []).find((p) => p.id === weekId || p.weekId === weekId) || null,
  }
}

// ── Habits ───────────────────────────────────────────────────

function visibleHabits(state, userId, viewerId, includeArchived) {
  return userHabits(state, userId)
    .filter((h) => includeArchived || !h.archived)
    .filter((h) => (h.visibility || 'family') !== 'private' || viewerId === userId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Habit progress for one member and week, honouring privacy: private habits
 * are only returned when `viewerId === userId`.
 * @param {FamilyState} state
 * @param {string} userId
 * @param {{ weekId?: string, viewerId?: string, includeArchived?: boolean }} [opts]
 * @returns {Array<{ habit: object, habitId: string, name: string, emoji: string,
 *   visibility: 'family'|'private', target: number, done: number, met: boolean,
 *   remaining: number, days: boolean[], isDaily: boolean, weekStreak: number,
 *   dayStreak: number|null, checkedToday: boolean }>}
 */
export function getHabitProgress(state, userId, { weekId = state.weekId, viewerId, includeArchived = false } = {}) {
  const hws = userHabitWeeks(state, userId)
  const hw = hws.find((x) => x.weekId === weekId) || null
  const todayIdx = weekDates(weekId).indexOf(state.today)
  return visibleHabits(state, userId, viewerId, includeArchived).map((habit) => {
    const p = computeHabitWeek(habit, hw, weekId)
    const daily = isDailyHabit(habit)
    return {
      habit,
      habitId: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      visibility: habit.visibility || 'family',
      target: p.target,
      done: p.done,
      met: p.met,
      remaining: p.remaining,
      days: p.days,
      isDaily: daily,
      weekStreak: getHabitWeekStreak(habit, hws, { currentWeekId: state.weekId }),
      dayStreak: daily ? getHabitDayStreak(habit, hws, state.today) : null,
      checkedToday: todayIdx >= 0 && p.days[todayIdx],
    }
  })
}

/**
 * Totals of a member's visible habits for a week.
 * @returns {{ total: number, met: number, perfect: boolean }}
 */
export function getHabitSummary(state, userId, { weekId = state.weekId, viewerId } = {}) {
  const hw = userHabitWeeks(state, userId).find((x) => x.weekId === weekId) || null
  const habits = userHabits(state, userId).filter((h) => (h.visibility || 'family') !== 'private' || viewerId === userId)
  const { total, met, perfect } = summarizeHabitWeek(habits, hw, weekId)
  return { total, met, perfect }
}

/**
 * Dates a habit can be checked on: today and the earlier days of the current week.
 * @returns {string[]} 'yyyy-MM-dd', Monday first
 */
export function getEditableHabitDates(state) {
  return weekDates(state.weekId).filter((d) => d <= state.today)
}

// ── Achievements ─────────────────────────────────────────────

/** The AchievementContext for one member (see domain/achievements.js). */
export function buildAchievementContext(state, userId) {
  return {
    userId,
    user: getMember(state, userId) || { id: userId },
    workouts: userWorkouts(state, userId),
    summaries: userSummaries(state, userId),
    habits: userHabits(state, userId),
    habitWeeks: userHabitWeeks(state, userId),
    allWorkouts: state.workouts || [],
    allSummaries: state.summaries || [],
    weekPosts: state.weekPosts || [],
    allUnlocks: state.unlocks || [],
    goals: index(state).goalsByUser[userId] || [],
    weekId: state.weekId,
    today: state.today,
  }
}

/**
 * The member's album: every sticker in album order with
 * `earned` (by history OR recorded unlock), `recorded` (unlock doc exists),
 * `unlockedAt` (ms from the unlock doc, or null), `seeded`, `unlock` (doc),
 * `progress` ({ current, target } | null).
 * Legacy stickers (clásicas) are omitted unless earned.
 * @param {FamilyState} state
 * @param {string} userId
 * @returns {object[]}
 */
export function getAchievements(state, userId) {
  return memo(state, `ach:${userId}`, () => {
    const unlocks = new Map((index(state).unlocksByUser[userId] || []).map((u) => [u.achievementId, u]))
    return evaluateAchievements(buildAchievementContext(state, userId))
      .map((a) => {
        const unlock = unlocks.get(a.id) || null
        const earned = a.earned || !!unlock
        return {
          ...a,
          earned,
          computedEarned: a.earned,
          recorded: !!unlock,
          unlock,
          seeded: !!unlock?.seeded,
          unlockedAt: unlock ? toMillis(unlock.createdAt) : null,
          progress: earned && a.progress ? { current: a.progress.target, target: a.progress.target } : a.progress,
        }
      })
      .filter((a) => !a.legacy || a.earned)
      .sort((a, b) => a.number - b.number)
  })
}

/**
 * What the client should record for a member.
 * - needsSeed: the member never opened v2 (no users.v2SeededAt): everything
 *   earned so far should go through seedUnlocks() silently.
 * - pending: definitions earned by history but without an unlock doc.
 * Only meaningful once the provider is `ready`.
 * @returns {{ needsSeed: boolean, pending: object[] }}
 */
export function getUnlockPlan(state, userId) {
  const member = getMember(state, userId)
  const pending = getAchievements(state, userId).filter((a) => a.computedEarned && !a.recorded)
  return { needsSeed: !member?.v2SeededAt, pending }
}

/**
 * Album totals for a member.
 * @returns {{ earned: number, total: number, percent: number,
 *   byRarity: Record<string, { earned: number, total: number }>,
 *   pages: Array<{ id, title, description, earned, total, items: object[] }>,
 *   latest: object[] }}  latest = up to 3 most recent non-seeded unlocks
 */
export function getAlbumSummary(state, userId) {
  const list = getAchievements(state, userId)
  const byRarity = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, { earned: 0, total: 0 }]))
  for (const a of list) {
    byRarity[a.rarity].total++
    if (a.earned) byRarity[a.rarity].earned++
  }
  const pages = ALBUM_PAGES.map((p) => {
    const items = list.filter((a) => a.category === p.id)
    return { ...p, items, total: items.length, earned: items.filter((a) => a.earned).length }
  }).filter((p) => p.total > 0)
  const earned = list.filter((a) => a.earned).length
  const latest = list.filter((a) => a.recorded && !a.seeded).sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0)).slice(0, 3)
  return { earned, total: list.length, percent: list.length ? Math.round((earned / list.length) * 100) : 0, byRarity, pages, latest }
}

// ── Personal goals ───────────────────────────────────────────

const GOAL_STATE_ORDER = { active: 0, achieved: 1, missed: 2, cancelled: 3 }

/**
 * One goal with its live progress and derived state.
 * @returns {{ goal: object, id: string, progress: { current, target, ratio, done },
 *   state: 'active'|'achieved'|'missed'|'cancelled', daysLeft: number,
 *   pace: { elapsedRatio, expected, onTrack, perDayNeeded }, habit: object|null,
 *   needsAchievedMark: boolean }}
 *   needsAchievedMark = stored status is still 'active' but the target is reached
 */
export function getGoalView(state, goal) {
  const progress = computeGoalProgress(goal, {
    workouts: userWorkouts(state, goal.userId),
    habitWeeks: userHabitWeeks(state, goal.userId),
  })
  return {
    goal,
    id: goal.id,
    progress,
    state: getGoalState(goal, progress, state.today),
    daysLeft: getGoalDaysLeft(goal, state.today),
    pace: getGoalPace(goal, progress, state.today),
    habit: goal.habitId ? (state.habits || []).find((h) => h.id === goal.habitId) || null : null,
    needsAchievedMark: (goal.status || 'active') === 'active' && progress.done,
  }
}

/**
 * A member's goals, honouring privacy (private goals only when
 * viewerId === userId). Active first (soonest deadline first), then
 * achieved / missed / cancelled (newest first).
 * @param {FamilyState} state
 * @param {string} userId
 * @param {{ viewerId?: string, includeCancelled?: boolean }} [opts]
 * @returns {ReturnType<typeof getGoalView>[]}
 */
export function getGoals(state, userId, { viewerId, includeCancelled = false } = {}) {
  return (index(state).goalsByUser[userId] || [])
    .filter((g) => (g.visibility || 'family') !== 'private' || viewerId === userId)
    .map((g) => getGoalView(state, g))
    .filter((v) => includeCancelled || v.state !== 'cancelled')
    .sort((a, b) => GOAL_STATE_ORDER[a.state] - GOAL_STATE_ORDER[b.state] ||
      (a.state === 'active' ? (a.goal.endDate || '').localeCompare(b.goal.endDate || '') : (b.goal.endDate || '').localeCompare(a.goal.endDate || '')))
}

// ── Stats ────────────────────────────────────────────────────

/**
 * Personal stats for profile / stats screens.
 * @param {FamilyState} state
 * @param {string} userId
 * @param {{ weeks?: number }} [opts]  length of the weekly series (default 12)
 * @returns {{
 *   totals: { sessions, minutes, calories, points, activeWeeks },
 *   averages: { minutesPerSession, caloriesPerSession, sessionsPerWeek },
 *   bests: { longestSession: object|null, mostCalories: object|null,
 *     bestWeekSessions: { weekId, value }|null, bestWeekMinutes: { weekId, value }|null,
 *     bestWeeklyStreak, currentWeeklyStreak, bestDayStreak, currentDayStreak },
 *   weekly: Array<{ weekId, sessions, minutes, calories, goal, status, met }>,
 *   activityByDate: Record<string, { sessions, minutes, calories }>,
 *   byType: Array<{ type, sessions, minutes }>,
 *   byWeekday: number[] }}  byWeekday = sessions per Mon..Sun
 */
export function getMemberStats(state, userId, { weeks = 12 } = {}) {
  return memo(state, `stats:${userId}:${weeks}`, () => {
    const ws = userWorkouts(state, userId)
    const summaries = userSummaries(state, userId)
    const minutes = ws.reduce((s, w) => s + (Number(w.duration) || 0), 0)
    const withCal = ws.filter((w) => Number(w.calories) > 0)
    const calories = withCal.reduce((s, w) => s + Number(w.calories), 0)

    const perWeek = {}
    const activityByDate = {}
    const types = {}
    const byWeekday = Array(7).fill(0)
    for (const w of ws) {
      const wk = workoutWeekId(w)
      if (wk) {
        const pw = (perWeek[wk] ||= { sessions: 0, minutes: 0 })
        pw.sessions++
        pw.minutes += Number(w.duration) || 0
      }
      if (w.date) {
        const a = (activityByDate[w.date] ||= { sessions: 0, minutes: 0, calories: 0 })
        a.sessions++
        a.minutes += Number(w.duration) || 0
        a.calories += Number(w.calories) || 0
        byWeekday[weekdayIndex(w.date)]++
      }
      for (const t of getExerciseTypes(w)) {
        const e = (types[t] ||= { type: t, sessions: 0, minutes: 0 })
        e.sessions++
        e.minutes += Number(w.duration) || 0
      }
    }
    const bestBy = (f) => {
      let best = null
      for (const [weekId, v] of Object.entries(perWeek)) if (!best || v[f] > best.value) best = { weekId, value: v[f] }
      return best
    }
    const maxWorkout = (f) => ws.reduce((m, w) => (Number(w[f]) > (Number(m?.[f]) || 0) ? w : m), null)

    const weekly = lastWeeks(state.weekId, weeks).map((weekId) => {
      const mw = getMemberWeek(state, userId, weekId)
      return { weekId, sessions: mw.sessions, minutes: mw.minutes, calories: mw.calories, goal: mw.goal, status: mw.status, met: mw.met }
    })
    const current = getMemberWeek(state, userId)

    return {
      totals: { sessions: ws.length, minutes, calories, points: ws.reduce((s, w) => s + getWorkoutPoints(w), 0), activeWeeks: Object.keys(perWeek).length },
      averages: {
        minutesPerSession: ws.length ? Math.round(minutes / ws.length) : 0,
        caloriesPerSession: withCal.length ? Math.round(calories / withCal.length) : 0,
        sessionsPerWeek: weeks ? Math.round((weekly.reduce((s, w) => s + w.sessions, 0) / weekly.length) * 10) / 10 : 0,
      },
      bests: {
        longestSession: maxWorkout('duration'),
        mostCalories: maxWorkout('calories'),
        bestWeekSessions: bestBy('sessions'),
        bestWeekMinutes: bestBy('minutes'),
        bestWeeklyStreak: Math.max(getBestWeeklyStreak(summaries), current.streak),
        currentWeeklyStreak: current.streak,
        bestDayStreak: getBestDayStreak(ws),
        currentDayStreak: getCurrentDayStreak(ws, state.today),
      },
      weekly,
      activityByDate,
      byType: Object.values(types).sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes),
      byWeekday,
    }
  })
}

/**
 * Family ranking.
 * @param {FamilyState} state
 * @param {{ metric?: 'sessions'|'minutes'|'calories'|'points'|'streak', weeks?: number|'all' }} [opts]
 *   weeks = window ending at the current week (default 1 = this week); ignored for 'streak'
 * @returns {Array<{ userId, member, value, rank }>}  highest first; ties share a rank
 */
export function getLeaderboard(state, { metric = 'sessions', weeks = 1 } = {}) {
  const window = weeks === 'all' ? null : new Set(lastWeeks(state.weekId, Math.max(1, weeks)))
  const rows = (state.members || []).map((m) => {
    let value
    if (metric === 'streak') value = getMemberWeek(state, m.id).streak
    else {
      const ws = userWorkouts(state, m.id).filter((w) => !window || window.has(workoutWeekId(w)))
      if (metric === 'minutes') value = ws.reduce((s, w) => s + (Number(w.duration) || 0), 0)
      else if (metric === 'calories') value = ws.reduce((s, w) => s + (Number(w.calories) || 0), 0)
      else if (metric === 'points') value = ws.reduce((s, w) => s + getWorkoutPoints(w), 0)
      else value = ws.length
    }
    return { userId: m.id, member: m, value }
  }).sort((a, b) => b.value - a.value)
  rows.forEach((r, i) => { r.rank = i > 0 && r.value === rows[i - 1].value ? rows[i - 1].rank : i + 1 })
  return rows
}

// ── Feed ─────────────────────────────────────────────────────

function workoutTs(w) {
  return toMillis(w.createdAt) ?? (w.date ? new Date(`${w.date}T12:00:00`).getTime() : 0)
}

function weekPostTs(p) {
  return toMillis(p.createdAt) ?? getWeekRange(p.weekId || p.id).end.getTime() + 10 * 60000
}

/**
 * The family feed, newest first: workouts, sticker unlocks (never seeded
 * ones), weekly results, and family-visible goals ('goalCreated' at createdAt,
 * 'goalAchieved' at achievedAt; both target the same goal doc for
 * reactions/comments, so use `key` — not `id` — as the React key).
 * @param {FamilyState} state
 * @param {{ limit?: number, viewerId?: string, before?: number, userId?: string }} [opts]
 *   before = only items older than this ms; userId = only that member's items
 *   (week posts are kept since they include everyone)
 * @returns {Array<{ kind: 'workout'|'unlock'|'weekPost'|'goalCreated'|'goalAchieved', key: string,
 *   id: string, ts: number, target: { kind: 'workout'|'unlock'|'weekPost'|'goal', id }, isMine: boolean,
 *   data: object }>}
 *   unlock data carries `achievement` (its definition, when known); goal items
 *   carry `data = getGoalView(...)` (goal + progress + state)
 */
export function buildFeed(state, { limit = 50, viewerId, before, userId } = {}) {
  const items = []
  for (const w of state.workouts || []) {
    if (userId && w.userId !== userId) continue
    items.push({ kind: 'workout', id: w.id, ts: workoutTs(w), data: w, isMine: w.userId === viewerId })
  }
  for (const u of state.unlocks || []) {
    if (u.seeded || (userId && u.userId !== userId)) continue
    items.push({
      kind: 'unlock', id: u.id, ts: toMillis(u.createdAt) ?? 0,
      data: { ...u, achievement: ACHIEVEMENTS_BY_ID[u.achievementId] || null }, isMine: u.userId === viewerId,
    })
  }
  for (const p of state.weekPosts || []) {
    items.push({ kind: 'weekPost', id: p.id || p.weekId, ts: weekPostTs(p), data: p, isMine: false })
  }
  for (const g of state.goals || []) {
    if ((g.visibility || 'family') === 'private' || g.status === 'cancelled') continue
    if (userId && g.userId !== userId) continue
    const view = getGoalView(state, g)
    const created = toMillis(g.createdAt)
    if (created != null) items.push({ kind: 'goalCreated', id: g.id, ts: created, data: view, isMine: g.userId === viewerId })
    const achieved = g.status === 'achieved' ? toMillis(g.achievedAt) : null
    if (achieved != null) items.push({ kind: 'goalAchieved', id: g.id, ts: achieved, data: view, isMine: g.userId === viewerId })
  }
  const targetKind = (k) => (k === 'goalCreated' || k === 'goalAchieved' ? 'goal' : k)
  return items
    .filter((i) => before == null || i.ts < before)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit)
    .map((i) => ({ ...i, key: `${i.kind}:${i.id}`, target: { kind: targetKind(i.kind), id: i.id } }))
}

/**
 * The doc behind a reaction/comment target.
 * @param {FamilyState} state
 * @param {{ kind: 'workout'|'unlock'|'weekPost'|'goal', id: string }} target
 * @returns {object|null}
 */
export function findTarget(state, target) {
  const list = { workout: state.workouts, unlock: state.unlocks, weekPost: state.weekPosts, goal: state.goals }[target?.kind] || []
  return list.find((d) => d.id === target.id) || null
}

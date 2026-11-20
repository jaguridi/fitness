import { describe, it, expect } from 'vitest'
import { createDemoSeed } from '../demo/seed.js'
import {
  mergeMembers, getMember, getMemberWeek, getFamilyWeek, computeMood, getHabitProgress, getHabitSummary,
  getEditableHabitDates, getAchievements, getUnlockPlan, getAlbumSummary, getMemberStats, getLeaderboard,
  buildFeed, findTarget, getGoals, getGoalView, lastWeeks,
} from '../selectors.js'
import { ACHIEVEMENTS } from '../../domain/achievements.js'
import { weekDates } from '../../game/habits.js'

const NOW = new Date(2026, 10, 20, 15, 0) // Fri, W47

function demoState(now = NOW, mutate) {
  const seed = createDemoSeed(now)
  mutate?.(seed)
  return {
    weekId: '2026-W47',
    today: '2026-11-20',
    members: mergeMembers(seed.users),
    workouts: seed.workouts,
    summaries: seed.summaries,
    habits: seed.habits,
    habitWeeks: seed.habitWeeks,
    unlocks: seed.unlocks,
    weekPosts: seed.weekPosts,
    goals: seed.goals,
  }
}

const WK = '2026-W47'
const D = weekDates(WK)

/** Tiny hand-made state. */
function miniState(over = {}) {
  return {
    weekId: WK,
    today: D[4],
    members: mergeMembers([{ id: 'user1', weeklyGoal: 2 }, { id: 'user2', restWeeks: [WK] }]),
    workouts: [],
    summaries: [],
    habits: [],
    habitWeeks: [],
    unlocks: [],
    weekPosts: [],
    goals: [],
    ...over,
  }
}

describe('members', () => {
  it('merges USERS with docs and defaults the goal', () => {
    const members = mergeMembers([{ id: 'user1', weeklyGoal: 5, name: 'X' }])
    expect(members).toHaveLength(4)
    expect(members[0]).toMatchObject({ id: 'user1', name: 'Jose', weeklyGoal: 5, restWeeks: [], prefs: { habitReminder: true } })
    expect(members[1].weeklyGoal).toBe(3)
    expect(getMember(miniState(), 'user2').name).toBe('Javi')
    expect(getMember(miniState(), 'nope')).toBeNull()
  })
})

describe('getMemberWeek', () => {
  it('live week with streak, mood and avatar', () => {
    const s = miniState({
      workouts: [{ id: 'a', userId: 'user1', date: D[0], weekId: WK, duration: 30 }, { id: 'b', userId: 'user1', date: D[2], weekId: WK, duration: 30 }],
      summaries: [{ userId: 'user1', weekId: '2026-W46', status: 'completed' }],
    })
    const w = getMemberWeek(s, 'user1')
    expect(w).toMatchObject({ sessions: 2, goal: 2, met: true, status: 'completed', streak: 2, mood: 'happy', isCurrent: true })
    expect(w.avatar).toBe('/avatars/jose_happy.png')
    expect(getMemberWeek(s, 'user2').status).toBe('rest')
  })

  it('closed weeks take status/goal from the summary (v1 statuses too)', () => {
    const s = miniState({ summaries: [{ userId: 'user1', weekId: '2026-W40', status: 'frozen', totalRequired: 0 }] })
    const w = getMemberWeek(s, 'user1', '2026-W40')
    expect(w.status).toBe('frozen')
    expect(w.goal).toBe(0)
    expect(w.closed).toBe(true)
    expect(w.summary).toBeTruthy()
  })

  it('is memoized per state', () => {
    const s = miniState()
    expect(getMemberWeek(s, 'user1')).toBe(getMemberWeek(s, 'user1'))
  })
})

describe('computeMood', () => {
  const missed = [{ weekId: '2026-W45', status: 'missed' }, { weekId: '2026-W46', status: 'missed' }]
  it('happy, sad, normal', () => {
    expect(computeMood({ met: true, streak: 0, sessionsThisWeek: 3, summaries: [], currentWeekId: WK })).toBe('happy')
    expect(computeMood({ met: false, streak: 3, sessionsThisWeek: 0, summaries: [], currentWeekId: WK })).toBe('happy')
    expect(computeMood({ met: false, streak: 0, sessionsThisWeek: 0, summaries: missed, currentWeekId: WK })).toBe('sad')
    expect(computeMood({ met: false, streak: 0, sessionsThisWeek: 1, summaries: missed, currentWeekId: WK })).toBe('normal')
    // A rest week in between is skipped (neutral).
    const withRest = [missed[0], { weekId: '2026-W46', status: 'rest' }, { weekId: '2026-W44', status: 'completed' }]
    expect(computeMood({ met: false, streak: 0, sessionsThisWeek: 0, summaries: withRest, currentWeekId: WK })).toBe('normal')
  })
})

describe('getFamilyWeek', () => {
  it('aggregates the 4 members and finds the post', () => {
    const s = demoState()
    const f = getFamilyWeek(s, '2026-W46')
    expect(f.members).toHaveLength(4)
    expect(f.post?.weekId).toBe('2026-W46')
    expect(f.sessions).toBe(f.members.reduce((a, m) => a + m.sessions, 0))
  })
})

describe('habits', () => {
  const habits = [
    { id: 'pub', userId: 'user1', name: 'Leer', emoji: '📚', targetPerWeek: 2, order: 1 },
    { id: 'priv', userId: 'user1', name: 'Secreto', emoji: '🤫', targetPerWeek: 7, visibility: 'private', order: 0 },
    { id: 'old', userId: 'user1', name: 'Viejo', targetPerWeek: 1, archived: true },
  ]
  const habitWeeks = [{ userId: 'user1', weekId: WK, checks: { pub: [D[0], D[4]], priv: [D[3], D[4]] } }]
  const s = miniState({ habits, habitWeeks })

  it('hides private habits from other viewers', () => {
    expect(getHabitProgress(s, 'user1', { viewerId: 'user2' }).map((h) => h.habitId)).toEqual(['pub'])
    expect(getHabitProgress(s, 'user1', {}).map((h) => h.habitId)).toEqual(['pub'])
    expect(getHabitProgress(s, 'user1', { viewerId: 'user1' }).map((h) => h.habitId)).toEqual(['priv', 'pub'])
    expect(getHabitProgress(s, 'user1', { viewerId: 'user1', includeArchived: true })).toHaveLength(3)
  })

  it('reports progress, streaks and today', () => {
    const [priv, pub] = getHabitProgress(s, 'user1', { viewerId: 'user1' })
    expect(pub).toMatchObject({ done: 2, target: 2, met: true, isDaily: false, dayStreak: null, checkedToday: true, weekStreak: 1 })
    expect(priv).toMatchObject({ done: 2, met: false, isDaily: true, dayStreak: 2 })
    expect(getHabitSummary(s, 'user1', { viewerId: 'user2' })).toEqual({ total: 1, met: 1, perfect: true })
  })

  it('editable dates are this week up to today', () => {
    expect(getEditableHabitDates(s)).toEqual(D.slice(0, 5))
  })
})

describe('achievements', () => {
  it('merges unlock docs and hides unearned legacy stickers', () => {
    const s = miniState({ unlocks: [{ id: 'user1_clean_record', userId: 'user1', achievementId: 'clean_record', createdAt: 1000, seeded: true }] })
    const list = getAchievements(s, 'user1')
    const clean = list.find((a) => a.id === 'clean_record')
    expect(clean).toMatchObject({ earned: true, recorded: true, seeded: true, unlockedAt: 1000 })
    expect(list.find((a) => a.id === 'shield_earned')).toBeUndefined()
    expect(list).toHaveLength(ACHIEVEMENTS.length - 2)
    const nums = list.map((a) => a.number)
    expect([...nums].sort((a, b) => a - b)).toEqual(nums)
  })

  it('unlock plan: seed when v2SeededAt is missing, pending = earned but unrecorded', () => {
    const s = miniState({ workouts: Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, userId: 'user1', date: `2026-10-0${(i % 9) + 1}`, duration: 10 })) })
    const plan = getUnlockPlan(s, 'user1')
    expect(plan.needsSeed).toBe(true)
    expect(plan.pending.map((a) => a.id)).toContain('sessions_10')
  })

  it('album summary on the demo seed', () => {
    const s = demoState()
    const sum = getAlbumSummary(s, 'user1')
    expect(sum.earned).toBeGreaterThan(5)
    expect(sum.pages.length).toBeGreaterThanOrEqual(8)
    expect(sum.pages.reduce((n, p) => n + p.total, 0)).toBe(sum.total)
    expect(Object.values(sum.byRarity).reduce((n, r) => n + r.total, 0)).toBe(sum.total)
    expect(sum.latest.every((a) => !a.seeded)).toBe(true)
    // Jose has one earned-but-unrecorded sticker in the demo.
    expect(getUnlockPlan(s, 'user1')).toMatchObject({ needsSeed: false })
    expect(getUnlockPlan(s, 'user1').pending).toHaveLength(1)
  })
})

describe('getMemberStats', () => {
  it('totals, bests and series', () => {
    const s = miniState({
      workouts: [
        { id: 'a', userId: 'user1', date: D[0], weekId: WK, duration: 60, calories: 500, exerciseType: ['Correr'] },
        { id: 'b', userId: 'user1', date: D[1], weekId: WK, duration: 30, exerciseType: 'Yoga' },
        { id: 'c', userId: 'user1', date: '2026-11-10', weekId: '2026-W46', duration: 120, calories: 700, exerciseType: ['Correr', 'Pesas'] },
      ],
    })
    const st = getMemberStats(s, 'user1', { weeks: 4 })
    expect(st.totals).toMatchObject({ sessions: 3, minutes: 210, calories: 1200, activeWeeks: 2 })
    expect(st.averages).toMatchObject({ minutesPerSession: 70, caloriesPerSession: 600, sessionsPerWeek: 0.8 })
    expect(st.bests.longestSession.id).toBe('c')
    expect(st.bests.mostCalories.id).toBe('c')
    expect(st.bests.bestWeekSessions).toEqual({ weekId: WK, value: 2 })
    expect(st.bests.bestWeekMinutes).toEqual({ weekId: '2026-W46', value: 120 })
    expect(st.bests.bestDayStreak).toBe(2)
    expect(st.weekly.map((w) => w.weekId)).toEqual(lastWeeks(WK, 4))
    expect(st.activityByDate[D[0]]).toEqual({ sessions: 1, minutes: 60, calories: 500 })
    expect(st.byType[0]).toEqual({ type: 'Correr', sessions: 2, minutes: 180 })
    expect(st.byWeekday[0]).toBe(1)
  })

  it('works for a member with nothing', () => {
    const st = getMemberStats(miniState(), 'user2')
    expect(st.totals.sessions).toBe(0)
    expect(st.bests.longestSession).toBeNull()
  })
})

describe('getLeaderboard', () => {
  const s = miniState({
    workouts: [
      { userId: 'user1', date: D[0], weekId: WK, duration: 30 },
      { userId: 'user2', date: D[0], weekId: WK, duration: 50 },
      { userId: 'user3', date: D[0], weekId: WK, duration: 10 },
      { userId: 'user3', date: '2026-11-10', weekId: '2026-W46', duration: 10 },
    ],
  })
  it('ranks with ties and windows', () => {
    const week = getLeaderboard(s, { metric: 'sessions', weeks: 1 })
    expect(week.map((r) => [r.userId, r.value, r.rank])).toEqual([['user1', 1, 1], ['user2', 1, 1], ['user3', 1, 1], ['user4', 0, 4]])
    expect(getLeaderboard(s, { metric: 'sessions', weeks: 'all' })[0]).toMatchObject({ userId: 'user3', value: 2, rank: 1 })
    expect(getLeaderboard(s, { metric: 'minutes' })[0].userId).toBe('user2')
    expect(getLeaderboard(s, { metric: 'streak' })).toHaveLength(4)
  })
})

describe('goals', () => {
  const goals = [
    { id: 'g1', userId: 'user1', title: 'Pub', kind: 'auto', metric: 'sessions', target: 2, startDate: '2026-11-01', endDate: '2026-11-30', visibility: 'family', status: 'active', createdAt: 100 },
    { id: 'g2', userId: 'user1', title: 'Priv', kind: 'manual', target: 4, progress: 1, startDate: '2026-11-01', endDate: '2026-12-31', visibility: 'private', status: 'active', createdAt: 200 },
    { id: 'g3', userId: 'user1', title: 'Hecha', kind: 'manual', target: 1, progress: 1, startDate: '2026-10-01', endDate: '2026-10-30', status: 'achieved', achievedAt: 300, createdAt: 50 },
    { id: 'g4', userId: 'user1', title: 'Cancelada', kind: 'manual', target: 1, startDate: '2026-10-01', endDate: '2026-12-30', status: 'cancelled', createdAt: 60 },
  ]
  const workouts = [{ id: 'w', userId: 'user1', date: D[0], weekId: WK, duration: 30, photoURL: 'x', createdAt: 400 },
    { id: 'w2', userId: 'user1', date: D[1], weekId: WK, duration: 30, createdAt: 500 }] // legacy doc without photo
  const s = miniState({ goals, workouts })

  it('getGoals applies privacy, derives state and sorts', () => {
    expect(getGoals(s, 'user1', { viewerId: 'user2' }).map((g) => g.id)).toEqual(['g1', 'g3'])
    const mine = getGoals(s, 'user1', { viewerId: 'user1' })
    expect(mine.map((g) => g.id)).toEqual(['g2', 'g1', 'g3'])
    expect(mine[1]).toMatchObject({ state: 'achieved', needsAchievedMark: true, progress: { current: 2, target: 2, done: true } })
    expect(mine[0]).toMatchObject({ state: 'active', daysLeft: 42, needsAchievedMark: false })
    expect(getGoals(s, 'user1', { viewerId: 'user1', includeCancelled: true })).toHaveLength(4)
    expect(getGoalView(s, goals[2]).state).toBe('achieved')
  })

  it('feed: goalCreated / goalAchieved for family goals only', () => {
    const feed = buildFeed(s, { viewerId: 'user1' })
    expect(feed.map((i) => i.key)).toEqual(['workout:w2', 'workout:w', 'goalAchieved:g3', 'goalCreated:g1', 'goalCreated:g3'])
    const achieved = feed.find((i) => i.kind === 'goalAchieved')
    expect(achieved.target).toEqual({ kind: 'goal', id: 'g3' })
    expect(achieved.data.goal.title).toBe('Hecha')
    expect(findTarget(s, achieved.target).id).toBe('g3')
  })
})

describe('buildFeed', () => {
  it('merges kinds newest first, excludes seeded unlocks, respects limit/before/userId', () => {
    const s = demoState()
    const feed = buildFeed(s, { limit: 500, viewerId: 'user1' })
    const kinds = new Set(feed.map((i) => i.kind))
    for (const k of ['workout', 'unlock', 'weekPost', 'goalCreated', 'goalAchieved']) expect(kinds.has(k), k).toBe(true)
    expect(feed.every((i, idx) => idx === 0 || feed[idx - 1].ts >= i.ts)).toBe(true)
    const unlockIds = feed.filter((i) => i.kind === 'unlock').map((i) => i.id)
    for (const id of unlockIds) expect(s.unlocks.find((u) => u.id === id).seeded).toBeFalsy()
    expect(feed.find((i) => i.kind === 'unlock').data.achievement).toBeTruthy()
    expect(new Set(feed.map((i) => i.key)).size).toBe(feed.length)
    // private goals never reach the feed
    const privateIds = s.goals.filter((g) => g.visibility === 'private').map((g) => g.id)
    expect(feed.some((i) => privateIds.includes(i.id) && i.target.kind === 'goal')).toBe(false)
    expect(buildFeed(s, { limit: 5 })).toHaveLength(5)
    const cut = feed[10].ts
    expect(buildFeed(s, { before: cut, limit: 500 }).every((i) => i.ts < cut)).toBe(true)
    const onlyFran = buildFeed(s, { userId: 'user4', limit: 500 })
    expect(onlyFran.filter((i) => i.kind === 'workout').every((i) => i.data.userId === 'user4')).toBe(true)
    expect(feed.find((i) => i.kind === 'workout').isMine).toBeDefined()
  })

  it('findTarget', () => {
    const s = demoState()
    const w = s.workouts[0]
    expect(findTarget(s, { kind: 'workout', id: w.id })).toBe(w)
    expect(findTarget(s, { kind: 'weekPost', id: s.weekPosts[0].id })).toBe(s.weekPosts[0])
    expect(findTarget(s, { kind: 'nope', id: 'x' })).toBeNull()
  })
})

describe('demo personalities', () => {
  it('Jose is consistent, Javi just came back, Fran has the best habits', () => {
    const s = demoState()
    const jose = getMemberStats(s, 'user1').bests
    expect(jose.bestWeeklyStreak).toBeGreaterThanOrEqual(8)
    const javi = getMemberWeek(s, 'user2', '2026-W46')
    expect(javi.status).toBe('completed')
    const fran = getHabitProgress(s, 'user4', { viewerId: 'user4' })
    expect(fran.length).toBe(4)
  })
})

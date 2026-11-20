import { describe, it, expect, vi } from 'vitest'
import { createDemoSeed, DEMO_PHOTOS } from '../demo/seed.js'
import { createDemoBackend } from '../backend.demo.js'
import * as firebaseBackend from '../backend.firebase.js'
import { pendingWeeks, runClientWeekClose, parkV1Lock } from '../weekClose.js'
import { mergeMembers } from '../selectors.js'
import { USER_IDS } from '../../game/constants.js'
import { getWeekId } from '../../game/weekId.js'

// The firebase backend must never initialise in tests.
vi.mock('../../firebase.js', () => ({ default: {}, db: {}, storage: {}, messagingPromise: Promise.resolve(null) }))

const NOW = new Date(2026, 10, 20, 15, 0) // Fri 2026-11-20, W47

describe('demo seed', () => {
  const seed = createDemoSeed(NOW)

  it('is deterministic for the same day', () => {
    expect(JSON.stringify(createDemoSeed(NOW))).toBe(JSON.stringify(seed))
  })

  it('has the 4 members with goals, prefs and seeded stickers', () => {
    expect(seed.users.map((u) => u.id)).toEqual(USER_IDS)
    for (const u of seed.users) {
      expect(u.weeklyGoal).toBeGreaterThanOrEqual(1)
      expect(u.prefs.habitReminder).toBe(true)
      expect(u.v2SeededAt.toMillis()).toBeLessThan(NOW.getTime())
    }
    expect(seed.users.find((u) => u.id === 'user2').restWeeks.length).toBeGreaterThan(0)
  })

  it('has a believable amount of workouts, all with a photo, none in the future', () => {
    expect(seed.workouts.length).toBeGreaterThanOrEqual(60)
    expect(seed.workouts.length).toBeLessThanOrEqual(90)
    for (const w of seed.workouts) {
      expect(DEMO_PHOTOS).toContain(w.photoURL)
      expect(w.date <= '2026-11-20').toBe(true)
      expect(w.createdAt.toMillis()).toBeLessThanOrEqual(NOW.getTime())
      expect(w.weekId).toBe(getWeekId(new Date(`${w.date}T12:00:00`)))
    }
    // newest first
    const times = seed.workouts.map((w) => w.createdAt.toMillis())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect(seed.workouts.some((w) => w.reactions)).toBe(true)
    expect(seed.workouts.some((w) => w.comments?.length)).toBe(true)
  })

  it('has 2–4 habits per member (one private) with checks', () => {
    for (const id of USER_IDS) {
      const active = seed.habits.filter((h) => h.userId === id && !h.archived)
      expect(active.length).toBeGreaterThanOrEqual(2)
      expect(active.length).toBeLessThanOrEqual(4)
    }
    expect(seed.habits.filter((h) => h.visibility === 'private')).toHaveLength(1)
    expect(seed.habitWeeks.length).toBeGreaterThan(10)
    for (const hw of seed.habitWeeks) {
      expect(hw.id).toBe(`${hw.userId}_${hw.weekId}`)
      for (const dates of Object.values(hw.checks)) for (const d of dates) expect(d <= '2026-11-20').toBe(true)
    }
  })

  it('has v2 summaries for 12 closed weeks and a few week posts with a recap', () => {
    expect(seed.summaries).toHaveLength(12 * 4)
    for (const s of seed.summaries) expect(s).toMatchObject({ v: 2, totalRequired: s.goal })
    expect(seed.weekPosts.length).toBeGreaterThanOrEqual(3)
    for (const p of seed.weekPosts) {
      expect(p.results).toHaveLength(4)
      expect(typeof p.recap).toBe('string')
      expect(p.recap.length).toBeGreaterThan(10)
    }
  })

  it('has unlocks: mostly seeded, a few recent ones for the feed, one left pending', () => {
    const recent = seed.unlocks.filter((u) => !u.seeded)
    expect(seed.unlocks.length).toBeGreaterThan(recent.length)
    expect(recent.length).toBeGreaterThanOrEqual(4)
    for (const u of seed.unlocks) expect(u.id).toBe(`${u.userId}_${u.achievementId}`)
  })

  it('meta: v2 lock at last week, v1 lock not parked yet', () => {
    expect(seed.meta.v2LastClosedWeekId).toBe('2026-W46')
    expect(seed.meta.lastAutoProcessedWeekId).toBe('2026-W46')
  })

  it('has 1–2 goals per member: auto + manual, rewards, one achieved, one private', () => {
    for (const id of USER_IDS) {
      const n = seed.goals.filter((g) => g.userId === id).length
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(2)
    }
    expect(seed.goals.some((g) => g.kind === 'auto')).toBe(true)
    expect(seed.goals.some((g) => g.kind === 'manual')).toBe(true)
    expect(seed.goals.some((g) => g.reward)).toBe(true)
    expect(seed.goals.some((g) => !g.reward)).toBe(true)
    expect(seed.goals.filter((g) => g.status === 'achieved')).toHaveLength(1)
    expect(seed.goals.filter((g) => g.visibility === 'private')).toHaveLength(1)
    const achieved = seed.goals.find((g) => g.status === 'achieved')
    expect(achieved.achievedAt.toMillis()).toBeLessThanOrEqual(NOW.getTime())
    for (const g of seed.goals.filter((x) => x.metric === 'habit')) {
      expect(seed.habits.some((h) => h.id === g.habitId && h.userId === g.userId)).toBe(true)
    }
  })
})

describe('demo backend', () => {
  it('matches the firebase backend interface', () => {
    const demo = createDemoBackend({ now: NOW })
    const fbFns = Object.entries(firebaseBackend).filter(([, v]) => typeof v === 'function').map(([k]) => k).sort()
    const demoFns = Object.entries(demo).filter(([, v]) => typeof v === 'function').map(([k]) => k).sort()
    expect(demoFns).toEqual(fbFns)
  })

  it('subscriptions fire immediately and after every mutation', async () => {
    const b = createDemoBackend({ now: NOW })
    const calls = []
    const unsub = b.subscribeWorkouts((list) => calls.push(list.length))
    expect(calls).toHaveLength(1)
    const before = calls[0]
    await expect(b.addWorkout({ userId: 'user1', date: '2026-11-20', weekId: '2026-W47', duration: 30 })).rejects.toThrow('foto')
    expect(calls).toHaveLength(1)
    const { id } = await b.addWorkout({ userId: 'user1', date: '2026-11-20', weekId: '2026-W47', duration: 30, exerciseType: ['Correr'], photoURL: '/demo/photo-1.svg' })
    expect(calls.at(-1)).toBe(before + 1)
    await b.updateWorkout(id, { duration: 45, calories: null })
    await b.deleteWorkout(id)
    expect(calls.at(-1)).toBe(before)
    unsub()
    await b.addWorkout({ userId: 'user1', date: '2026-11-20', weekId: '2026-W47', duration: 30, photoURL: '/demo/photo-2.svg' })
    expect(calls.at(-1)).toBe(before)
  })

  it('new workouts come first and get a timestamp', async () => {
    const b = createDemoBackend({ now: NOW })
    const { id } = await b.addWorkout({ userId: 'user2', date: '2026-11-20', weekId: '2026-W47', duration: 30 }, { name: 'x.jpg' })
    let first
    b.subscribeWorkouts((list) => { first = list[0] })
    expect(first.id).toBe(id)
    expect(typeof first.createdAt.toMillis()).toBe('number')
  })

  it('reactions and comments work on every target kind', async () => {
    const b = createDemoBackend({ now: NOW })
    const seed = createDemoSeed(NOW)
    const targets = [
      { kind: 'workout', id: seed.workouts[0].id },
      { kind: 'unlock', id: seed.unlocks[0].id },
      { kind: 'weekPost', id: seed.weekPosts[0].id },
      { kind: 'goal', id: seed.goals[0].id },
    ]
    for (const t of targets) {
      await b.setReaction(t, 'user3', '🔥')
      await b.addComment(t, 'user3', '  ¡Bien!  ')
    }
    let workouts, unlocks, posts, goals
    b.subscribeWorkouts((l) => { workouts = l })
    b.subscribeUnlocks((l) => { unlocks = l })
    b.subscribeWeekPosts((l) => { posts = l })
    b.subscribeGoals((l) => { goals = l })
    for (const [list, t] of [[workouts, targets[0]], [unlocks, targets[1]], [posts, targets[2]], [goals, targets[3]]]) {
      const d = list.find((x) => x.id === t.id)
      expect(d.reactions.user3).toBe('🔥')
      expect(d.comments.at(-1)).toMatchObject({ userId: 'user3', text: '¡Bien!' })
    }
    await b.setReaction(targets[0], 'user3', null)
    b.subscribeWorkouts((l) => { workouts = l })
    expect(workouts.find((x) => x.id === targets[0].id).reactions?.user3).toBeUndefined()
    await expect(b.setReaction({ kind: 'workout', id: 'nope' }, 'user1', '🔥')).rejects.toThrow()
  })

  it('habit CRUD and checks', async () => {
    const b = createDemoBackend({ now: NOW })
    const id = await b.saveHabit({ userId: 'user1', name: 'Estirar', emoji: '🤸', targetPerWeek: 3, order: 5 })
    await b.saveHabit({ id, name: 'Estirar más' })
    await b.toggleHabitCheck('user1', '2026-W47', id, '2026-11-20', true)
    await b.toggleHabitCheck('user1', '2026-W47', id, '2026-11-19', true)
    await b.toggleHabitCheck('user1', '2026-W47', id, '2026-11-20', false)
    await b.archiveHabit(id)
    let habits, hws
    b.subscribeHabits((l) => { habits = l })
    b.subscribeHabitWeeks((l) => { hws = l })
    const h = habits.find((x) => x.id === id)
    expect(h).toMatchObject({ name: 'Estirar más', archived: true, visibility: 'family', targetPerWeek: 3 })
    expect(hws.find((x) => x.id === 'user1_2026-W47').checks[id]).toEqual(['2026-11-19'])
    await b.reorderHabits([id])
    b.subscribeHabits((l) => { habits = l })
    expect(habits.find((x) => x.id === id).order).toBe(0)
  })

  it('setUser merges nested prefs and supports remove; rest weeks toggle', async () => {
    const b = createDemoBackend({ now: NOW })
    await b.setUser('user1', { prefs: { theme: 'dark' }, pin: '1234' })
    await b.setUser('user1', { weeklyGoal: 4 }, { remove: ['pin'] })
    await b.setRestWeek('user1', '2026-W48', true)
    const u = await b.getUser('user1')
    expect(u.prefs).toEqual({ habitReminder: true, theme: 'dark' })
    expect(u.weeklyGoal).toBe(4)
    expect(u.pin).toBeUndefined()
    expect(u.restWeeks).toContain('2026-W48')
    expect(typeof u.v2SeededAt.toMillis).toBe('function')
    await b.setRestWeek('user1', '2026-W48', false)
    expect((await b.getUser('user1')).restWeeks).not.toContain('2026-W48')
  })

  it('unlocks: record dedupes, seed is silent and stamps the user', async () => {
    const b = createDemoBackend({ now: NOW })
    const def = { id: 'sessions_250', name: 'X', description: 'Y', icon: '🏛️', rarity: 'legendaria', number: 13 }
    expect(await b.recordUnlock('user4', def)).toBe(true)
    expect(await b.recordUnlock('user4', def)).toBe(false)
    const n = await b.seedUnlocks('user4', [def, { ...def, id: 'variety_10', number: 31 }])
    expect(n).toBe(1)
    let unlocks
    b.subscribeUnlocks((l) => { unlocks = l })
    const seeded = unlocks.find((u) => u.id === 'user4_variety_10')
    expect(seeded.seeded).toBe(true)
    expect(seeded.createdAt.toDate().getFullYear()).toBe(2020)
    expect(unlocks.find((u) => u.id === 'user4_sessions_250').seeded).toBeUndefined()
  })

  it('setWeekPost never clobbers reactions/comments', async () => {
    const b = createDemoBackend({ now: NOW })
    const seed = createDemoSeed(NOW)
    const post = seed.weekPosts.at(-1)
    await b.setReaction({ kind: 'weekPost', id: post.id }, 'user1', '🎉')
    await b.setWeekPost(post.id, { weekId: post.id, v: 2, results: [], reactions: {}, comments: [] })
    let posts
    b.subscribeWeekPosts((l) => { posts = l })
    const p = posts.find((x) => x.id === post.id)
    expect(p.reactions.user1).toBe('🎉')
    expect(p.results).toEqual([])
    expect(p.createdAt.toMillis()).toBe(post.createdAt.toMillis())
  })

  it('v2 lock protocol (own fields, never touches the v1 lock)', async () => {
    const b = createDemoBackend({ now: NOW })
    expect(await b.claimWeekProcessing('2026-W46')).toBe(false) // already closed
    expect(await b.claimWeekProcessing('2026-W47')).toBe(true)
    expect(await b.claimWeekProcessing('2026-W47')).toBe(false) // claimed
    await b.completeWeekProcessing('2026-W47')
    const meta = await b.getAppMeta()
    expect(meta.v2LastClosedWeekId).toBe('2026-W47')
    expect(meta.v2Processing).toBeUndefined()
    expect(meta.lastAutoProcessedWeekId).toBe('2026-W46')
  })

  it('missing v2LastClosedWeekId = the week before V2_START_WEEK', async () => {
    const seed = createDemoSeed(NOW)
    seed.meta = {}
    const b = createDemoBackend({ now: NOW, seed })
    expect(await b.claimWeekProcessing('2026-W46')).toBe(false)
    expect(await b.claimWeekProcessing('2026-W47')).toBe(true)
  })

  it('parks the v1 lock once, keeping the old value', async () => {
    const b = createDemoBackend({ now: NOW })
    expect(await parkV1Lock(b)).toBe(true)
    expect(await parkV1Lock(b)).toBe(false)
    const meta = await b.getAppMeta()
    expect(meta.lastAutoProcessedWeekId).toBe('9999-W99')
    expect(meta.v1LastProcessedWeekId).toBe('2026-W46')
    expect(meta.v1FinesDisabledAt).toBeTruthy()
  })

  it('goals: create, edit, progress, achieve once, cancel', async () => {
    const b = createDemoBackend({ now: NOW })
    const id = await b.saveGoal({ userId: 'user3', title: 'Leer 3 libros', kind: 'manual', target: 3, unit: 'libros',
      startDate: '2026-11-01', endDate: '2026-12-31', reward: 'Un libro nuevo', status: 'achieved' })
    let goals
    b.subscribeGoals((l) => { goals = l })
    expect(goals.find((g) => g.id === id)).toMatchObject({ status: 'active', visibility: 'family', reward: 'Un libro nuevo' })
    await b.saveGoal({ id, reward: '' })
    await b.updateGoalProgress(id, 2)
    b.subscribeGoals((l) => { goals = l })
    expect(goals.find((g) => g.id === id).reward).toBeUndefined()
    expect(goals.find((g) => g.id === id).progress).toBe(2)
    expect(await b.markGoalAchieved(id)).toBe(true)
    expect(await b.markGoalAchieved(id)).toBe(false)
    expect(await b.markGoalMissed(id)).toBe(false)
    b.subscribeGoals((l) => { goals = l })
    const first = goals.find((g) => g.id === id).achievedAt.toMillis()
    expect(typeof first).toBe('number')
    const id2 = await b.saveGoal({ userId: 'user3', title: 'X', kind: 'manual', target: 1, startDate: '2026-11-01', endDate: '2026-11-02' })
    await b.cancelGoal(id2)
    b.subscribeGoals((l) => { goals = l })
    expect(goals.find((g) => g.id === id2).status).toBe('cancelled')
  })

  it('canned callables', async () => {
    const b = createDemoBackend({ now: NOW })
    expect((await b.getWeeklyRecap('2026-W46')).recap).toBeTruthy()
    expect((await b.getWeeklyRecap('2020-W01')).recap).toBeTruthy()
    expect((await b.getMonthlyRecap('2026-10')).recap).toBeTruthy()
    expect((await b.sendNudge('user2', 'Jose')).success).toBe(true)
    expect(await b.registerPush('user1')).toBe('demo-token')
  })
})

describe('client week close', () => {
  it('pendingWeeks walks the v2 lock and never goes before V2_START_WEEK', () => {
    expect(pendingWeeks('2026-W46', '2026-W47')).toEqual([])
    expect(pendingWeeks(undefined, '2026-W47')).toEqual([])
    expect(pendingWeeks(undefined, '2026-W48')).toEqual(['2026-W47'])
    expect(pendingWeeks('2026-W47', '2026-W50')).toEqual(['2026-W48', '2026-W49'])
    expect(pendingWeeks('2026-W40', '2026-W49')).toEqual(['2026-W47', '2026-W48'])
    expect(pendingWeeks('2026-W49', '2026-W49')).toEqual([])
  })

  it('closes pending v2 weeks with summaries, posts and expired goals', async () => {
    const now = new Date(2026, 11, 2, 12) // W49
    const seed = createDemoSeed(now)
    seed.meta = { lastAutoProcessedWeekId: '9999-W99' } // v2 lock missing → starts at W47
    seed.summaries = seed.summaries.filter((s) => s.weekId < '2026-W47')
    seed.weekPosts = seed.weekPosts.filter((p) => p.weekId < '2026-W47')
    seed.goals = [...seed.goals, {
      id: 'old', userId: 'user1', title: 'Vencida', kind: 'manual', target: 5, progress: 1,
      startDate: '2026-11-01', endDate: '2026-11-25', visibility: 'family', status: 'active',
    }]
    const b = createDemoBackend({ now, seed })
    const data = {
      currentWeekId: '2026-W49', users: mergeMembers(seed.users), workouts: seed.workouts,
      habits: seed.habits, habitWeeks: seed.habitWeeks, summaries: seed.summaries, goals: seed.goals,
    }
    const processed = await runClientWeekClose(b, data)
    expect(processed).toEqual(['2026-W47', '2026-W48'])
    let summaries, posts, goals
    b.subscribeSummaries((l) => { summaries = l })
    b.subscribeWeekPosts((l) => { posts = l })
    b.subscribeGoals((l) => { goals = l })
    expect(summaries.filter((s) => s.weekId === '2026-W47')).toHaveLength(4)
    expect(summaries.filter((s) => s.weekId === '2026-W48')).toHaveLength(4)
    expect(posts.filter((p) => p.weekId >= '2026-W47').map((p) => p.weekId).sort()).toEqual(['2026-W47', '2026-W48'])
    expect(goals.find((g) => g.id === 'old').status).toBe('missed')
    // W48 streaks build on the W47 summaries written in the same run.
    const w47 = posts.find((p) => p.weekId === '2026-W47').results
    const w48 = posts.find((p) => p.weekId === '2026-W48').results
    for (const r of w48) {
      const prev = w47.find((x) => x.userId === r.userId)
      if (r.status === 'completed' && prev.status === 'completed') expect(r.streak).toBe(prev.streak + 1)
    }
    const meta = await b.getAppMeta()
    expect(meta.v2LastClosedWeekId).toBe('2026-W48')
    expect(meta.lastAutoProcessedWeekId).toBe('9999-W99')
    expect(await runClientWeekClose(b, data)).toEqual([])
  })

  it('stops when another device holds the claim', async () => {
    const seed = createDemoSeed(NOW)
    seed.meta = { v2LastClosedWeekId: '2026-W46', v2Processing: { weekId: '2026-W47' } }
    const b = createDemoBackend({ now: new Date(2026, 11, 2), seed })
    const processed = await runClientWeekClose(b, { currentWeekId: '2026-W49', users: [], workouts: [], habits: [], habitWeeks: [], summaries: [] })
    expect(processed).toEqual([])
  })
})

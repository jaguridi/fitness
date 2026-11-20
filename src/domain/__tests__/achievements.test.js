import { describe, it, expect } from 'vitest'
import {
  ACHIEVEMENTS, ALBUM_PAGES, RARITIES, evaluateAchievements, getAchievementDef, familyWeeks,
} from '../achievements.js'
import { weekDates } from '../../game/habits.js'

// Every id that existed in v1 (production unlock docs reference them).
const V1_IDS = [
  'first_week', 'streak_4', 'streak_8', 'streak_12', 'day_streak_7', 'day_streak_14', 'day_streak_30',
  'sessions_10', 'sessions_50', 'sessions_100', 'long_session_60', 'long_session_90', 'long_session_120',
  'total_minutes_500', 'total_minutes_2000', 'total_minutes_5000', 'avg_intensity', 'big_week_minutes',
  'first_burn', 'session_burn_500', 'session_burn_1000', 'total_burn_5000', 'total_burn_20000',
  'total_burn_100000', 'big_week_calories', 'variety_3', 'variety_6', 'overachiever', 'shield_earned',
  'life_saver', 'clean_record', 'comeback', 'early_bird',
]

const WK = '2026-W47'
const D = weekDates(WK)

function ctx(over = {}) {
  return { userId: 'user1', user: { id: 'user1' }, workouts: [], summaries: [], habits: [], habitWeeks: [],
    allWorkouts: [], allSummaries: [], weekPosts: [], weekId: WK, today: D[4], ...over }
}
const earned = (c) => new Set(evaluateAchievements(c).filter((a) => a.earned).map((a) => a.id))

describe('definitions', () => {
  it('keeps every v1 id', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    for (const id of V1_IDS) expect(ids.has(id), id).toBe(true)
  })

  it('has unique ids and unique, consecutive album numbers', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    const nums = ACHIEVEMENTS.map((a) => a.number).sort((a, b) => a - b)
    expect(new Set(nums).size).toBe(nums.length)
    expect(nums[0]).toBe(1)
    expect(nums.at(-1)).toBe(ACHIEVEMENTS.length)
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(45)
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(55)
  })

  it('every definition is well-formed', () => {
    const pages = new Set(ALBUM_PAGES.map((p) => p.id))
    for (const a of ACHIEVEMENTS) {
      expect(pages.has(a.category), a.id).toBe(true)
      expect(RARITIES[a.rarity], a.id).toBeTruthy()
      expect(a.name && a.description && a.icon, a.id).toBeTruthy()
      expect(typeof a.check).toBe('function')
    }
  })

  it('has few legendaries', () => {
    const legend = ACHIEVEMENTS.filter((a) => a.rarity === 'legendaria').length
    expect(legend).toBeGreaterThan(0)
    expect(legend).toBeLessThanOrEqual(6)
  })

  it('marks the fine-era stickers as legacy clásicas', () => {
    for (const id of ['clean_record', 'shield_earned', 'life_saver']) {
      expect(getAchievementDef(id)).toMatchObject({ category: 'clasicas', legacy: true })
    }
    expect(ACHIEVEMENTS.filter((a) => a.legacy).length).toBe(3)
  })

  it('never uses voseo in copy', () => {
    const text = ACHIEVEMENTS.map((a) => `${a.name} ${a.description}`).join(' ')
    expect(text).not.toMatch(/(podés|tenés|elegí|hacé|registrá|sumá|\bvos\b)/i)
  })
})

describe('evaluateAchievements', () => {
  it('returns nothing earned for an empty user', () => {
    const list = evaluateAchievements(ctx())
    expect(list).toHaveLength(ACHIEVEMENTS.length)
    expect(list.filter((a) => a.earned)).toEqual([])
    expect(list.find((a) => a.id === 'sessions_10').progress).toEqual({ current: 0, target: 10 })
    expect(list.find((a) => a.id === 'first_burn').progress).toBeNull()
  })

  it('works with a bare context (defaults)', () => {
    expect(() => evaluateAchievements({ userId: 'user1' })).not.toThrow()
  })

  it('volume, minutes, calories, variety and photo stickers', () => {
    const types = ['Correr', 'Pesas', 'Yoga', 'Natación', 'Baile', 'Fútbol']
    const workouts = Array.from({ length: 12 }, (_, i) => ({
      userId: 'user1', date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      duration: i === 0 ? 125 : 50, calories: i === 1 ? 1100 : 200,
      exerciseType: [types[i % types.length]], photoURL: 'x',
    }))
    const e = earned(ctx({ workouts }))
    for (const id of ['sessions_10', 'long_session_60', 'long_session_90', 'long_session_120', 'total_minutes_500',
      'avg_intensity', 'first_burn', 'session_burn_500', 'session_burn_1000', 'variety_3', 'variety_6',
      'day_streak_7', 'photo_10', 'big_week_minutes']) {
      expect(e.has(id), id).toBe(true)
    }
    expect(e.has('sessions_25')).toBe(false)
    expect(e.has('day_streak_14')).toBe(false)
    expect(e.has('season2_first')).toBe(false)
    const p = evaluateAchievements(ctx({ workouts })).find((a) => a.id === 'sessions_25').progress
    expect(p).toEqual({ current: 12, target: 25 })
  })

  it('earned progress is reported as complete', () => {
    const workouts = Array.from({ length: 11 }, () => ({ duration: 10, date: '2026-10-01' }))
    const a = evaluateAchievements(ctx({ workouts })).find((x) => x.id === 'sessions_10')
    expect(a.progress).toEqual({ current: 10, target: 10 })
  })

  it('streak stickers use v2 streak rules', () => {
    const weeks = ['2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44']
    const summaries = [
      { weekId: weeks[0], status: 'completed' }, { weekId: weeks[1], status: 'rest' },
      { weekId: weeks[2], status: 'completed' }, { weekId: weeks[3], status: 'completed', lifeUsed: true },
      { weekId: weeks[4], status: 'completed' },
    ]
    const e = earned(ctx({ summaries }))
    expect(e.has('first_week')).toBe(true)
    expect(e.has('streak_4')).toBe(true)
    expect(e.has('streak_8')).toBe(false)
    expect(e.has('life_saver')).toBe(true)
  })

  it('comeback, overachiever, early bird, weekend warrior and season 2', () => {
    const summaries = [{ weekId: '2026-W44', status: 'missed' }, { weekId: '2026-W45', status: 'rest' },
      { weekId: '2026-W46', status: 'completed' }]
    const workouts = [D[0], D[1], D[2], D[5], D[6]].map((date) => ({ date, duration: 20 }))
    const e = earned(ctx({ summaries, workouts }))
    for (const id of ['comeback', 'overachiever', 'early_bird', 'weekend_warrior', 'season2_first']) {
      expect(e.has(id), id).toBe(true)
    }
  })

  it('clean_record can no longer be earned; shield_earned reads v1 summaries', () => {
    const e = earned(ctx({ user: { walletBalance: 0 }, summaries: [{ weekId: '2026-W10', status: 'completed', shieldEarned: true }] }))
    expect(e.has('clean_record')).toBe(false)
    expect(e.has('shield_earned')).toBe(true)
  })

  it('habit stickers', () => {
    const daily = { id: 'h1', userId: 'user1', targetPerWeek: 7, createdAt: new Date(2026, 10, 9).getTime() }
    const prev = weekDates('2026-W46')
    const habitWeeks = [
      { userId: 'user1', weekId: '2026-W46', checks: { h1: prev } },
      { userId: 'user1', weekId: WK, checks: { h1: [D[0], D[1]] } },
    ]
    const e = earned(ctx({ habits: [daily], habitWeeks }))
    expect(e.has('habit_first_check')).toBe(true)
    expect(e.has('habit_streak_7')).toBe(true)
    expect(e.has('habit_perfect_week')).toBe(true)
    expect(e.has('habit_streak_30')).toBe(false)
    expect(e.has('habit_perfect_4')).toBe(false)
    const p = evaluateAchievements(ctx({ habits: [daily], habitWeeks })).find((a) => a.id === 'habit_streak_30').progress
    expect(p).toEqual({ current: 9, target: 30 })
  })

  it('four perfect habit weeks in a row', () => {
    const h = { id: 'h', userId: 'user1', targetPerWeek: 1, createdAt: new Date(2026, 9, 26).getTime() } // W44
    const habitWeeks = ['2026-W44', '2026-W45', '2026-W46', WK].map((wk) => ({ weekId: wk, checks: { h: [weekDates(wk)[0]] } }))
    expect(earned(ctx({ habits: [h], habitWeeks })).has('habit_perfect_4')).toBe(true)
    const gap = habitWeeks.filter((w) => w.weekId !== '2026-W45')
    expect(earned(ctx({ habits: [h], habitWeeks: gap })).has('habit_perfect_4')).toBe(false)
  })

  it('family stickers', () => {
    const ids = ['user1', 'user2', 'user3', 'user4']
    const mk = (wk, statuses) => statuses.map((st, i) => ({ userId: ids[i], weekId: wk, status: st }))
    const allSummaries = [
      ...mk('2026-W44', ['completed', 'completed', 'completed', 'completed']),
      ...mk('2026-W45', ['completed', 'rest', 'completed', 'completed']),
      ...mk('2026-W46', ['completed', 'completed', 'missed', 'completed']),
    ]
    const fw = familyWeeks(allSummaries)
    expect(fw.map((w) => w.family)).toEqual([true, true, false])
    const e = earned(ctx({ allSummaries }))
    expect(e.has('family_week')).toBe(true)
    expect(e.has('family_streak_2')).toBe(true)
    expect(e.has('family_streak_4')).toBe(false)
    // A week with a missing member doesn't count
    expect(familyWeeks(mk('2026-W47', ['completed', 'completed', 'completed'])).map((w) => w.family)).toEqual([false])
  })

  it('social stickers count reactions and comments everywhere', () => {
    const allWorkouts = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, reactions: { user1: '🔥' } }))
    const weekPosts = Array.from({ length: 3 }, () => ({ reactions: { user1: '👏' }, comments: [{ userId: 'user1', text: 'Vamos' }] }))
    const allUnlocks = [{ reactions: { user1: '🎉' } }, { reactions: { user1: '🎉' } }]
    let e = earned(ctx({ allWorkouts, weekPosts, allUnlocks }))
    expect(e.has('reactions_25')).toBe(true)
    expect(e.has('first_comment')).toBe(true)
    e = earned(ctx({ allWorkouts: allWorkouts.slice(0, 5) }))
    expect(e.has('reactions_25')).toBe(false)
    expect(e.has('first_comment')).toBe(false)
  })

  it('goal stickers', () => {
    const g = (over) => ({ userId: 'user1', kind: 'manual', target: 1, startDate: '2026-11-01', endDate: '2026-11-30', ...over })
    expect(earned(ctx({ goals: [g({ status: 'active' })] })).has('goal_first')).toBe(false)
    // reached but not yet marked counts
    expect(earned(ctx({ goals: [g({ status: 'active', progress: 1 })] })).has('goal_first')).toBe(true)
    // cancelled/missed don't
    expect(earned(ctx({ goals: [g({ status: 'cancelled', progress: 1 })] })).has('goal_first')).toBe(false)
    const fast = g({ status: 'achieved', achievedAt: new Date(2026, 10, 5).getTime() })
    const e = earned(ctx({ goals: [fast] }))
    expect(e.has('goal_first')).toBe(true)
    expect(e.has('goal_fast')).toBe(true)
    const five = Array.from({ length: 5 }, () => g({ status: 'achieved', achievedAt: new Date(2026, 10, 29).getTime() }))
    const e5 = earned(ctx({ goals: five }))
    expect(e5.has('goals_5')).toBe(true)
    expect(e5.has('goal_fast')).toBe(false)
  })
})

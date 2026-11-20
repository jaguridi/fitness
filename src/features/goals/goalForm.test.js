import { describe, expect, it } from 'vitest'
import { computeGoalProgress, getGoalPace, getGoalDaysLeft } from '../../game/goals.js'
import {
  autoTitle,
  buildGoalPayload,
  describeGoal,
  detectPreset,
  favoriteExerciseType,
  formFromGoal,
  formFromTemplate,
  formatAmount,
  formatRange,
  goalContributions,
  goalPaceHint,
  periodPhrase,
  presetDates,
  updateForm,
  validateGoalForm,
} from './goalForm.js'

const TODAY = '2026-11-20' // viernes, 2026-W47

describe('dates', () => {
  it('formats ranges in Spanish', () => {
    expect(formatRange('2026-12-01', '2026-12-31')).toBe('entre el 1 y el 31 de diciembre')
    expect(formatRange('2026-11-20', '2026-12-31')).toBe('entre el 20 de noviembre y el 31 de diciembre')
    expect(formatRange('2026-12-20', '2027-01-15')).toBe('entre el 20 de diciembre de 2026 y el 15 de enero de 2027')
    expect(formatRange('2026-11-20', '2026-11-20')).toBe('el 20 de noviembre')
  })

  it('builds presets and detects them back', () => {
    expect(presetDates('week', TODAY)).toEqual({ startDate: '2026-11-16', endDate: '2026-11-22' })
    expect(presetDates('month', TODAY)).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(presetDates('year', TODAY)).toEqual({ startDate: TODAY, endDate: '2026-12-31' })
    expect(presetDates('custom', TODAY)).toEqual({ startDate: TODAY, endDate: '2026-12-20' })
    expect(detectPreset('2026-11-01', '2026-11-30', TODAY)).toBe('month')
    expect(detectPreset('2026-11-16', '2026-11-22', TODAY)).toBe('week')
    expect(detectPreset('2026-11-02', '2026-11-30', TODAY)).toBe('custom')
  })

  it('phrases periods for titles', () => {
    expect(periodPhrase('2026-12-01', '2026-12-31', TODAY)).toBe('en diciembre')
    expect(periodPhrase('2026-11-16', '2026-11-22', TODAY)).toBe('esta semana')
    expect(periodPhrase(TODAY, '2026-12-31', TODAY)).toBe('antes de fin de año')
    expect(periodPhrase(TODAY, '2027-01-15', TODAY)).toBe('antes del 15 de enero de 2027')
  })
})

describe('templates → forms', () => {
  const ctx = { today: TODAY, weeklyGoal: 3, habits: [{ id: 'h1', name: 'Leer', emoji: '📚' }], favoriteType: 'Yoga' }

  it('sessions this month', () => {
    const f = formFromTemplate('sessions_month', ctx)
    expect(f).toMatchObject({ kind: 'auto', metric: 'sessions', target: '12', startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(f.title).toBe('12 sesiones en noviembre')
    expect(describeGoal(f)).toBe('12 sesiones entre el 1 y el 30 de noviembre')
  })

  it('minutes this week', () => {
    const f = formFromTemplate('minutes_week', ctx)
    expect(f.title).toBe('150 minutos esta semana')
    expect(f.startDate).toBe('2026-11-16')
  })

  it('one sport N times uses the favourite type', () => {
    const f = formFromTemplate('sport_times', ctx)
    expect(f.exerciseType).toBe('Yoga')
    expect(f.title).toBe('Yoga 8 veces en noviembre')
  })

  it('habit days picks the first habit', () => {
    const f = formFromTemplate('habit_days', ctx)
    expect(f).toMatchObject({ metric: 'habit', habitId: 'h1', emoji: '📚' })
    expect(f.title).toBe('Leer 20 días en noviembre')
  })

  it('free goal is manual and untitled', () => {
    const f = formFromTemplate('free', ctx)
    expect(f).toMatchObject({ kind: 'manual', title: '', target: '' })
    expect(describeGoal({ ...f, target: '100', unit: 'km' })).toBe('100 km entre el 20 de noviembre y el 20 de diciembre')
  })

  it('keeps the auto title in sync until the user types one', () => {
    let f = formFromTemplate('sessions_month', ctx)
    f = updateForm(f, { target: '10' }, ctx)
    expect(f.title).toBe('10 sesiones en noviembre')
    f = updateForm(f, { period: 'year' }, ctx)
    expect(f.endDate).toBe('2026-12-31')
    expect(f.title).toBe('10 sesiones antes de fin de año')
    f = updateForm(f, { title: 'Mi meta' }, ctx)
    f = updateForm(f, { target: '20' }, ctx)
    expect(f.title).toBe('Mi meta')
  })

  it('auto title is empty for manual goals', () => {
    expect(autoTitle({ kind: 'manual', target: '4' })).toBe('')
  })
})

describe('validation', () => {
  const base = formFromTemplate('sessions_month', { today: TODAY, weeklyGoal: 3 })

  it('accepts a valid template form', () => {
    expect(validateGoalForm(base, { today: TODAY })).toEqual({})
  })

  it('requires title, positive target and ordered dates', () => {
    const e = validateGoalForm({ ...base, title: ' ', target: '0', startDate: '2026-12-10', endDate: '2026-12-01' }, { today: TODAY })
    expect(e.title).toBeTruthy()
    expect(e.target).toBeTruthy()
    expect(e.dates).toMatch(/antes del inicio/)
  })

  it('rejects past end dates only for new goals', () => {
    const past = { ...base, startDate: '2026-10-01', endDate: '2026-10-31' }
    expect(validateGoalForm(past, { today: TODAY }).dates).toMatch(/ya pasó/)
    expect(validateGoalForm(past, { today: TODAY, isNew: false }).dates).toBeUndefined()
  })

  it('needs a habit and whole numbers for auto goals; decimals ok for manual', () => {
    expect(validateGoalForm({ ...base, metric: 'habit', habitId: '' }, { today: TODAY }).habitId).toBeTruthy()
    expect(validateGoalForm({ ...base, target: '2.5' }, { today: TODAY }).target).toBeTruthy()
    expect(validateGoalForm({ ...base, kind: 'manual', target: '42,2', unit: 'km' }, { today: TODAY })).toEqual({})
  })

  it('caps habit days at the length of the period', () => {
    const f = { ...base, metric: 'habit', habitId: 'h1', target: '31' }
    expect(validateGoalForm(f, { today: TODAY }).target).toMatch(/más días/)
  })
})

describe('payload', () => {
  it('nulls fields that do not apply', () => {
    const f = { ...formFromTemplate('free', { today: TODAY }), title: 'Correr 100 km', target: '100', unit: 'km' }
    const p = buildGoalPayload(f)
    expect(p).toMatchObject({ kind: 'manual', metric: null, exerciseType: null, habitId: null, target: 100, unit: 'km', progress: 0 })
    expect(p.id).toBeUndefined()
  })

  it('auto payload drops unit and progress, keeps the filter', () => {
    const f = formFromTemplate('sport_times', { today: TODAY, favoriteType: 'Yoga' })
    const p = buildGoalPayload({ ...f, unit: 'x', progress: 3 }, { id: 'g1' })
    expect(p).toMatchObject({ id: 'g1', kind: 'auto', metric: 'sessions', exerciseType: 'Yoga', unit: null, progress: null, reward: null })
  })

  it('round-trips an existing goal', () => {
    const goal = { id: 'g', title: 'Leer 4 libros', emoji: '📖', kind: 'manual', target: 4, unit: 'libros', progress: 1,
      startDate: '2026-11-10', endDate: '2027-01-19', visibility: 'private', reward: 'Un libro nuevo' }
    const p = buildGoalPayload(formFromGoal(goal, TODAY), { id: 'g' })
    expect(p).toMatchObject({ title: goal.title, emoji: '📖', kind: 'manual', target: 4, unit: 'libros', progress: 1,
      startDate: goal.startDate, endDate: goal.endDate, visibility: 'private', reward: 'Un libro nuevo' })
  })
})

describe('contributions match computeGoalProgress', () => {
  const workouts = [
    { id: 'w1', userId: 'u', date: '2026-11-03', exerciseType: ['Yoga'], duration: 40 },
    { id: 'w2', userId: 'u', date: '2026-11-10', exerciseType: 'Correr', duration: 30, calories: 300 },
    { id: 'w3', userId: 'u', date: '2026-11-18', exerciseType: ['Yoga', 'Pesas'], duration: 60, calories: 200 },
    { id: 'w4', userId: 'other', date: '2026-11-18', exerciseType: ['Yoga'], duration: 60 },
    { id: 'w5', userId: 'u', date: '2026-10-30', exerciseType: ['Yoga'], duration: 60 },
  ]
  const habitWeeks = [
    { userId: 'u', weekId: '2026-W46', checks: { h1: ['2026-11-10', '2026-11-11'] } },
    { userId: 'u', weekId: '2026-W47', checks: { h1: ['2026-11-16', '2026-11-16'] } },
    { userId: 'other', weekId: '2026-W47', checks: { h1: ['2026-11-17'] } },
  ]
  const g = (extra) => ({ userId: 'u', kind: 'auto', target: 10, startDate: '2026-11-01', endDate: '2026-11-30', ...extra })

  for (const goal of [
    g({ metric: 'sessions' }),
    g({ metric: 'sessions', exerciseType: 'Yoga' }),
    g({ metric: 'minutes' }),
    g({ metric: 'minutes', exerciseType: 'Yoga' }),
    g({ metric: 'calories' }),
    g({ metric: 'habit', habitId: 'h1' }),
    { ...g({}), kind: 'manual', progress: 4 },
  ]) {
    it(`${goal.kind} ${goal.metric || ''} ${goal.exerciseType || ''}`, () => {
      expect(goalContributions(goal, { workouts, habitWeeks }).total).toBe(computeGoalProgress(goal, { workouts, habitWeeks }).current)
    })
  }

  it('lists the matching sessions newest first', () => {
    const c = goalContributions(g({ metric: 'sessions', exerciseType: 'Yoga' }), { workouts })
    expect(c.items.map((i) => i.id)).toEqual(['w3', 'w1'])
  })

  it('finds the favourite exercise type', () => {
    expect(favoriteExerciseType(workouts)).toBe('Yoga')
    expect(favoriteExerciseType([])).toBeNull()
  })
})

describe('pace hint', () => {
  const view = (goal, current, today = TODAY) => {
    const progress = { current, target: goal.target, ratio: current / goal.target, done: current >= goal.target }
    return { goal, progress, state: progress.done ? 'achieved' : 'active', daysLeft: getGoalDaysLeft(goal, today), pace: getGoalPace(goal, progress, today) }
  }
  const month = { kind: 'auto', metric: 'sessions', target: 12, startDate: '2026-11-01', endDate: '2026-11-30' }

  it('says on track kindly', () => {
    expect(goalPaceHint(view(month, 9), TODAY)).toBe('Vas al día. Te faltan 3 sesiones.')
  })

  it('suggests a weekly pace when behind', () => {
    const long = { ...month, endDate: '2026-12-31' }
    expect(goalPaceHint(view(long, 2), TODAY)).toBe('Con 2 sesiones por semana la logras.')
  })

  it('counts down in the last week', () => {
    const short = { ...month, endDate: '2026-11-25' }
    expect(goalPaceHint(view(short, 3), TODAY)).toBe('Te faltan 9 sesiones en 6 días. Todavía se puede.')
  })

  it('handles the last day, future starts and closed goals', () => {
    expect(goalPaceHint(view(month, 10, '2026-11-30'), '2026-11-30')).toBe('Hoy es el último día. Te faltan 2 sesiones.')
    const future = { ...month, startDate: '2026-12-01', endDate: '2026-12-31' }
    expect(goalPaceHint(view(future, 0), TODAY)).toBe('Empieza el 1 de diciembre.')
    expect(goalPaceHint(view(month, 12), TODAY)).toBeNull()
  })

  it('formats manual amounts with their unit', () => {
    expect(formatAmount({ kind: 'manual', unit: 'km' }, 12.5)).toBe('12,5 km')
    expect(formatAmount({ kind: 'manual' }, 3)).toBe('3')
    expect(formatAmount({ kind: 'auto', metric: 'sessions', exerciseType: 'Yoga' }, 1)).toBe('1 vez')
  })
})

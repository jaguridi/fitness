import { describe, expect, it } from 'vitest'
import {
  availableSuggestions,
  buildHabitPayload,
  dayStreakLabel,
  emptyHabitForm,
  firstGrapheme,
  habitFormFromHabit,
  habitTargetLabel,
  isEmoji,
  moveItem,
  summarizeHabits,
  validateHabitForm,
  weekStreakLabel,
} from './habitForm.js'

describe('labels', () => {
  it('describes the weekly target', () => {
    expect(habitTargetLabel(7)).toBe('Todos los días')
    expect(habitTargetLabel(1)).toBe('1 día por semana')
    expect(habitTargetLabel(5)).toBe('5 días por semana')
  })
  it('describes streaks', () => {
    expect(weekStreakLabel(0)).toBeNull()
    expect(weekStreakLabel(1)).toBe('Racha de 1 semana')
    expect(weekStreakLabel(4)).toBe('Racha de 4 semanas')
    expect(dayStreakLabel(1)).toBeNull()
    expect(dayStreakLabel(12)).toBe('12 días seguidos')
  })
})

describe('emoji', () => {
  it('takes the first grapheme, including ZWJ sequences', () => {
    expect(firstGrapheme('👨‍👩‍👧 familia')).toBe('👨‍👩‍👧')
    expect(firstGrapheme('  📚')).toBe('📚')
    expect(firstGrapheme('')).toBe('')
  })
  it('detects emojis', () => {
    expect(isEmoji('🧘‍♀️')).toBe(true)
    expect(isEmoji('a')).toBe(false)
  })
})

describe('form', () => {
  const habits = [
    { id: 'h1', name: 'Leer', archived: false },
    { id: 'h2', name: 'Meditar', archived: true },
  ]

  it('prefills from a suggestion', () => {
    expect(emptyHabitForm({ name: 'Leer', emoji: '📚', targetPerWeek: 5 })).toEqual({
      name: 'Leer', emoji: '📚', targetPerWeek: 5, visibility: 'family',
    })
  })

  it('validates name and duplicates (accent and case insensitive, ignoring archived)', () => {
    expect(validateHabitForm({ name: '  ' }).name).toMatch(/nombre/)
    expect(validateHabitForm({ name: 'x'.repeat(41) }).name).toMatch(/40/)
    expect(validateHabitForm({ name: 'leér' }, { habits }).name).toMatch(/Ya tienes/)
    expect(validateHabitForm({ name: 'Leer' }, { habits, editingId: 'h1' })).toEqual({})
    expect(validateHabitForm({ name: 'Meditar' }, { habits })).toEqual({})
    expect(validateHabitForm({ name: 'Agua', emoji: 'a' }).emoji).toBeTruthy()
  })

  it('builds a clean payload', () => {
    expect(buildHabitPayload({ name: ' Leer ', emoji: '📚📚', targetPerWeek: 9, visibility: 'private' }, 'h1')).toEqual({
      id: 'h1', name: 'Leer', emoji: '📚', targetPerWeek: 7, visibility: 'private',
    })
    expect(buildHabitPayload({ name: 'Agua', emoji: '', targetPerWeek: 3 })).toEqual({
      name: 'Agua', emoji: '✅', targetPerWeek: 3, visibility: 'family',
    })
  })

  it('reads an existing habit', () => {
    expect(habitFormFromHabit({ name: 'Leer', emoji: '📚', targetPerWeek: 4 })).toEqual({
      name: 'Leer', emoji: '📚', targetPerWeek: 4, visibility: 'family',
    })
  })

  it('hides suggestions already taken', () => {
    const s = [{ name: 'Leer' }, { name: 'Meditar' }, { name: 'Caminar' }]
    expect(availableSuggestions(s, habits).map((x) => x.name)).toEqual(['Meditar', 'Caminar'])
  })
})

describe('summary and order', () => {
  it('summarizes the week and finds the best streak', () => {
    const s = summarizeHabits([
      { name: 'Leer', emoji: '📚', met: true, weekStreak: 2 },
      { name: 'Agua', emoji: '💧', met: false, weekStreak: 5 },
      { name: 'Estirar', emoji: '🤸', met: false, weekStreak: 0 },
    ])
    expect(s).toEqual({ total: 3, met: 1, best: { name: 'Agua', emoji: '💧', weeks: 5 } })
    expect(summarizeHabits([]).best).toBeNull()
  })

  it('moves items up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    const same = ['a', 'b']
    expect(moveItem(same, 0, -1)).toBe(same)
  })
})

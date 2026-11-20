import { describe, expect, it } from 'vitest'
import {
  canEditWorkout,
  dayLabel,
  formatDuration,
  goalUnit,
  groupByDay,
  joinNames,
  reactorsLine,
  sessionLabel,
  sessionOrdinals,
  sortWeekResults,
  trainedOnHint,
  weekHeadline,
  weekRangeLabel,
  workoutMeta,
  workoutTitle,
} from '../feedUtils'

const at = (s) => new Date(s).getTime()
const NOW = at('2026-11-20T15:00:00') // viernes

describe('dayLabel', () => {
  it('names today, yesterday, this past week and older days', () => {
    expect(dayLabel(at('2026-11-20T08:00:00'), NOW)).toBe('Hoy')
    expect(dayLabel(at('2026-11-19T23:30:00'), NOW)).toBe('Ayer')
    expect(dayLabel(at('2026-11-16T10:00:00'), NOW)).toBe('Lunes 16')
    expect(dayLabel(at('2026-11-09T10:00:00'), NOW)).toBe('Lunes 9 de noviembre')
    expect(dayLabel(at('2025-12-31T10:00:00'), NOW)).toBe('Miércoles 31 de diciembre de 2025')
  })
})

describe('groupByDay', () => {
  it('groups consecutive items of the same local day', () => {
    const items = [
      { key: 'a', ts: at('2026-11-20T10:00:00') },
      { key: 'b', ts: at('2026-11-20T08:00:00') },
      { key: 'c', ts: at('2026-11-18T22:00:00') },
    ]
    const groups = groupByDay(items)
    expect(groups.map((g) => g.day)).toEqual(['2026-11-20', '2026-11-18'])
    expect(groups[0].items.map((i) => i.key)).toEqual(['a', 'b'])
  })
  it('handles an empty feed', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('sessionOrdinals / sessionLabel', () => {
  const ws = [
    { id: 'w3', userId: 'user1', date: '2026-11-19', weekId: '2026-W47', createdAt: at('2026-11-19T20:00:00') },
    { id: 'w1', userId: 'user1', date: '2026-11-16', weekId: '2026-W47', createdAt: at('2026-11-18T09:00:00') },
    { id: 'w2', userId: 'user1', date: '2026-11-16', weekId: '2026-W47', createdAt: at('2026-11-18T10:00:00') },
    { id: 'o1', userId: 'user2', date: '2026-11-16', weekId: '2026-W47', createdAt: at('2026-11-16T10:00:00') },
    { id: 'p1', userId: 'user1', date: '2026-11-12', weekId: '2026-W46', createdAt: at('2026-11-12T10:00:00') },
  ]
  it('orders by training date, then creation time, per member and week', () => {
    const m = sessionOrdinals(ws)
    expect(m.get('w1')).toBe(1)
    expect(m.get('w2')).toBe(2)
    expect(m.get('w3')).toBe(3)
    expect(m.get('o1')).toBe(1)
    expect(m.get('p1')).toBe(1)
  })
  it('labels the session against the goal', () => {
    expect(sessionLabel(2, 3)).toEqual({ label: '2.ª de 3', tone: 'member' })
    expect(sessionLabel(3, 3)).toEqual({ label: '3.ª de 3', tone: 'done' })
    expect(sessionLabel(4, 3)).toEqual({ label: 'Extra', tone: 'neutral' })
    expect(sessionLabel(null, 3)).toBeNull()
  })
})

describe('canEditWorkout', () => {
  const w = { userId: 'user1', createdAt: { seconds: Math.floor(at('2026-11-20T10:00:00') / 1000) } }
  it('lets only the owner edit within 24 h', () => {
    expect(canEditWorkout(w, 'user1', NOW)).toBe(true)
    expect(canEditWorkout(w, 'user2', NOW)).toBe(false)
    expect(canEditWorkout(w, 'user1', at('2026-11-21T10:00:01'))).toBe(false)
  })
  it('refuses docs without createdAt', () => {
    expect(canEditWorkout({ userId: 'user1' }, 'user1', NOW)).toBe(false)
    expect(canEditWorkout(null, 'user1', NOW)).toBe(false)
  })
})

describe('workout text', () => {
  it('formats duration', () => {
    expect(formatDuration(1)).toBe('1 minuto')
    expect(formatDuration(45)).toBe('45 minutos')
    expect(formatDuration(95)).toBe('1 h 35 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(0)).toBe('')
  })
  it('builds title and meta without middle dots', () => {
    const w = { exerciseType: ['Correr', 'Pesas'], duration: 52, calories: 1480 }
    expect(workoutTitle(w)).toBe('Correr + Pesas')
    expect(workoutTitle({ exerciseType: 'Yoga' })).toBe('Yoga')
    expect(workoutTitle({})).toBe('Ejercicio')
    expect(workoutMeta(w)).toBe('52 minutos, 1.480 kcal')
    expect(workoutMeta({ duration: 30 })).toBe('30 minutos')
  })
  it('hints the training day only when it was logged later', () => {
    expect(trainedOnHint({ date: '2026-11-17', createdAt: at('2026-11-18T09:00:00') })).toBe('del martes 17')
    expect(trainedOnHint({ date: '2026-11-18', createdAt: at('2026-11-18T09:00:00') })).toBeNull()
    expect(trainedOnHint({ date: '2026-11-18' })).toBeNull()
  })
})

describe('names and reactions', () => {
  const members = [
    { id: 'user1', name: 'Jose' },
    { id: 'user2', name: 'Javi' },
    { id: 'user4', name: 'Fran' },
  ]
  it('joins names in Spanish', () => {
    expect(joinNames(['Javi'])).toBe('Javi')
    expect(joinNames(['Javi', 'Fran'])).toBe('Javi y Fran')
    expect(joinNames(['Javi', 'Fran', 'tú'])).toBe('Javi, Fran y tú')
  })
  it('says who reacted, with you last', () => {
    expect(reactorsLine({}, members, 'user1')).toBe('')
    expect(reactorsLine({ user2: '🔥' }, members, 'user1')).toBe('Reaccionó Javi')
    expect(reactorsLine({ user1: '🔥', user2: '💪', user4: '👏' }, members, 'user1')).toBe('Reaccionaron Javi, Fran y tú')
    expect(reactorsLine({ user1: '🔥' }, members, 'user1')).toBe('Reaccionaste tú')
    expect(reactorsLine({ user2: null }, members, 'user1')).toBe('')
  })
})

describe('weekly result', () => {
  const nameOf = (id) => ({ user1: 'Jose', user2: 'Javi', user3: 'Gonza', user4: 'Fran' })[id]
  const r = (userId, status, sessions = 0) => ({ userId, status, sessions })
  it('writes a kind headline', () => {
    expect(weekHeadline([r('user1', 'completed'), r('user2', 'completed'), r('user3', 'completed'), r('user4', 'completed')], nameOf)).toBe(
      'Toda la familia logró la semana'
    )
    expect(weekHeadline([r('user1', 'completed'), r('user2', 'missed')], nameOf)).toBe('Jose logró la semana')
    expect(weekHeadline([r('user1', 'completed'), r('user2', 'completed'), r('user3', 'rest'), r('user4', 'missed')], nameOf)).toBe(
      'Jose y Javi lograron la semana'
    )
    expect(weekHeadline([r('user1', 'completed'), r('user2', 'completed'), r('user3', 'completed'), r('user4', 'rest')], nameOf)).toBe(
      'Tres lograron la semana'
    )
    expect(weekHeadline([r('user1', 'missed'), r('user2', 'rest')], nameOf)).toBe('Una semana tranquila en la familia')
    expect(weekHeadline([r('user1', 'rest'), r('user2', 'rest')], nameOf)).toBe('Semana de descanso para todos')
  })
  it('orders achieved first, then rest, then the rest', () => {
    const sorted = sortWeekResults([r('user1', 'missed', 1), r('user2', 'rest'), r('user3', 'completed', 3), r('user4', 'completed', 5)])
    expect(sorted.map((x) => x.userId)).toEqual(['user4', 'user3', 'user2', 'user1'])
  })
  it('labels the week range', () => {
    expect(weekRangeLabel('2026-W46')).toBe('Semana del 9 al 15 de noviembre')
    expect(weekRangeLabel('2026-W49')).toBe('Semana del 30 de noviembre al 6 de diciembre')
  })
})

describe('goalUnit', () => {
  it('derives the unit from the goal', () => {
    expect(goalUnit({ kind: 'auto', metric: 'sessions' })).toBe('sesiones')
    expect(goalUnit({ kind: 'auto', metric: 'minutes' })).toBe('minutos')
    expect(goalUnit({ kind: 'auto', metric: 'calories' })).toBe('kcal')
    expect(goalUnit({ kind: 'auto', metric: 'habit' })).toBe('días')
    expect(goalUnit({ kind: 'manual', unit: 'km' })).toBe('km')
    expect(goalUnit({ kind: 'manual' })).toBe('')
  })
})

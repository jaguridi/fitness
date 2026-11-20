import { describe, expect, it } from 'vitest'
import { getHeadline, getSubline, getMemberStatus, isBehind, pickNextSticker, goalUnit, sessionsPerDay, plural } from '../todayCopy'

const week = (o = {}) => {
  const goal = o.goal ?? 3
  const sessions = o.sessions ?? 0
  const met = sessions >= goal
  return {
    goal, sessions, met, rest: false, closed: false, daysLeft: 3, streak: 0,
    extras: Math.max(0, sessions - goal), remaining: met ? 0 : goal - sessions,
    daysTrained: Array(7).fill(false), ...o,
  }
}

describe('getHeadline', () => {
  it('sessions remaining', () => {
    expect(getHeadline(week({ sessions: 2 })).title).toBe('Te falta 1 sesión para lograr la semana')
    expect(getHeadline(week({ sessions: 1, daysLeft: 5 })).title).toBe('Te faltan 2 sesiones para lograr la semana')
  })
  it('week achieved and extras', () => {
    expect(getHeadline(week({ sessions: 3 }))).toEqual({ title: '¡Semana lograda!', tone: 'done' })
    expect(getHeadline(week({ sessions: 4 })).title).toBe('Semana lograda, y vas con 1 sesión extra')
    expect(getHeadline(week({ sessions: 5 })).title).toBe('Semana lograda, y vas con 2 sesiones extra')
  })
  it('rest week', () => {
    expect(getHeadline(week({ rest: true })).tone).toBe('rest')
    expect(getHeadline(week({ rest: true })).title).toBe('Esta semana te toca descansar')
    expect(getHeadline(week({ rest: true, sessions: 1 })).title).toMatch(/te moviste/)
    // reaching the goal on a rest week still counts as achieved
    expect(getHeadline(week({ rest: true, sessions: 3 })).tone).toBe('done')
  })
  it('nothing logged: Monday vs mid vs late week', () => {
    expect(getHeadline(week({ daysLeft: 7 })).title).toBe('Semana nueva: tu meta son 3 sesiones')
    expect(getHeadline(week({ daysLeft: 7, goal: 1 })).title).toBe('Semana nueva: tu meta es 1 sesión')
    expect(getHeadline(week({ daysLeft: 5 })).title).toBe('Te faltan 3 sesiones para lograr la semana')
    expect(getHeadline(week({ daysLeft: 2 })).title).toBe('Todavía estás a tiempo: te faltan 3 sesiones')
    expect(getHeadline(week({ daysLeft: 1 })).title).toBe('Hoy es el último día: te faltan 3 sesiones')
  })
  it('last day with some sessions', () => {
    expect(getHeadline(week({ sessions: 2, daysLeft: 1 })).title).toBe('Hoy es el último día: te falta 1 sesión')
  })
  it('never mentions fines', () => {
    for (const s of [0, 1, 2, 3, 4]) for (const d of [1, 3, 7]) expect(getHeadline(week({ sessions: s, daysLeft: d })).title).not.toMatch(/multa|\$/i)
  })
})

describe('getSubline', () => {
  it('streak and days left', () => {
    expect(getSubline(week({ streak: 4, daysLeft: 4 }))).toEqual({ text: 'Racha de 4 semanas. Quedan 4 días, contando hoy.', flame: true })
    expect(getSubline(week({ streak: 1, daysLeft: 1 })).text).toBe('Racha de 1 semana. La semana cierra a medianoche.')
    expect(getSubline(week({ streak: 2, daysLeft: 7 })).text).toBe('Racha de 2 semanas. Tienes los 7 días por delante.')
  })
  it('no streak invites to start one', () => {
    const s = getSubline(week({ streak: 0 }))
    expect(s.flame).toBe(false)
    expect(s.text).toMatch(/^Logra la semana para empezar tu racha\./)
  })
  it('met', () => {
    expect(getSubline(week({ sessions: 3, streak: 5 })).text).toBe('Racha de 5 semanas. La semana cierra el domingo.')
  })
  it('rest keeps the streak', () => {
    expect(getSubline(week({ rest: true, streak: 3 })).text).toBe('Tu racha de 3 semanas queda intacta.')
    expect(getSubline(week({ rest: true })).text).toBe('No suma ni rompe tu racha.')
  })
})

describe('getMemberStatus', () => {
  it('covers each case', () => {
    expect(getMemberStatus(week({ sessions: 1 }))).toEqual({ text: '1 de 3', tone: 'todo' })
    expect(getMemberStatus(week({ sessions: 3 }))).toEqual({ text: 'Lograda', tone: 'done' })
    expect(getMemberStatus(week({ sessions: 4 })).text).toBe('Lograda, +1')
    expect(getMemberStatus(week({ rest: true })).text).toBe('Descanso')
  })
})

describe('isBehind', () => {
  it('never on Monday', () => {
    expect(isBehind(week(), 0)).toBe(false)
  })
  it('behind pace and no session today', () => {
    expect(isBehind(week({ sessions: 1 }), 4)).toBe(true) // Friday: expected 1.7
    expect(isBehind(week({ sessions: 2 }), 4)).toBe(false)
  })
  it('not when trained today, resting or done', () => {
    const d = Array(7).fill(false)
    d[4] = true
    expect(isBehind(week({ sessions: 1, daysTrained: d }), 4)).toBe(false)
    expect(isBehind(week({ rest: true }), 4)).toBe(false)
    expect(isBehind(week({ sessions: 3 }), 6)).toBe(false)
  })
})

describe('pickNextSticker', () => {
  const a = (id, current, target, extra = {}) => ({ id, number: extra.number ?? 1, earned: false, progress: { current, target }, ...extra })
  it('picks the highest ratio, unearned, with progress', () => {
    const list = [a('x', 1, 10), a('y', 3, 4), a('z', 9, 10, { earned: true }), { id: 'n', earned: false, progress: null }]
    expect(pickNextSticker(list).id).toBe('y')
  })
  it('ties: fewer left, then lower number', () => {
    expect(pickNextSticker([a('big', 5, 10), a('small', 1, 2)]).id).toBe('small')
    expect(pickNextSticker([a('b', 1, 2, { number: 9 }), a('a', 1, 2, { number: 3 })]).id).toBe('a')
  })
  it('null when nothing measurable', () => {
    expect(pickNextSticker([])).toBeNull()
    expect(pickNextSticker([a('legacy', 0, 1, { legacy: true })])).toBeNull()
  })
})

describe('small helpers', () => {
  it('goalUnit', () => {
    expect(goalUnit({ kind: 'auto', metric: 'minutes' })).toBe('minutos')
    expect(goalUnit({ kind: 'manual', unit: 'km' })).toBe('km')
    expect(goalUnit({ kind: 'auto', metric: 'habit' })).toBe('días')
  })
  it('sessionsPerDay', () => {
    const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
    expect(sessionsPerDay([{ date: '2026-11-16' }, { date: '2026-11-16' }, { date: '2026-11-20' }], dates)).toEqual([2, 0, 0, 0, 1, 0, 0])
  })
  it('plural', () => {
    expect(plural(1, 'sesión', 'sesiones')).toBe('1 sesión')
    expect(plural(0, 'sesión', 'sesiones')).toBe('0 sesiones')
  })
})

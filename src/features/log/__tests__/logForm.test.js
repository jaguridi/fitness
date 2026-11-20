import { describe, expect, it } from 'vitest'
import {
  initialValues, validateLog, orderExerciseTypes, normalizeSportName, photoDateNote,
  getLogCelebration, successDescription, joinEs, parseIntField,
} from '../logForm'

const TODAY = '2026-11-20' // viernes, semana 2026-W47
const WEEK = '2026-W47'

describe('initialValues', () => {
  it('defaults to today', () => {
    expect(initialValues(null, TODAY)).toEqual({ date: TODAY, types: [], duration: '', calories: '', description: '' })
  })
  it('honors initial values', () => {
    const v = initialValues({ date: '2026-11-18', exerciseType: 'Correr', duration: 45, calories: 300, description: 'Cerro' }, TODAY)
    expect(v).toEqual({ date: '2026-11-18', types: ['Correr'], duration: '45', calories: '300', description: 'Cerro' })
  })
  it('ignores future or malformed dates', () => {
    expect(initialValues({ date: '2026-11-25' }, TODAY).date).toBe(TODAY)
    expect(initialValues({ date: 'ayer' }, TODAY).date).toBe(TODAY)
  })
})

describe('validateLog', () => {
  const base = { date: TODAY, today: TODAY, types: ['Correr'], duration: '45', calories: '', hasPhoto: true, photoBlocked: false, processingPhoto: false }
  it('valid form', () => {
    expect(validateLog(base)).toMatchObject({ canSubmit: true, missing: [], missingText: null, errors: {} })
  })
  it('lists what is missing', () => {
    const v = validateLog({ ...base, types: [], duration: '', hasPhoto: false })
    expect(v.canSubmit).toBe(false)
    expect(v.missingText).toBe('Faltan el tipo de ejercicio, los minutos y la foto.')
    expect(validateLog({ ...base, hasPhoto: false }).missingText).toBe('Falta la foto.')
    expect(validateLog({ ...base, duration: '' }).missingText).toBe('Faltan los minutos.')
  })
  it('duration range 1–300', () => {
    expect(validateLog({ ...base, duration: '0' }).errors.duration).toBeTruthy()
    expect(validateLog({ ...base, duration: '301' }).errors.duration).toBeTruthy()
    expect(validateLog({ ...base, duration: '300' }).canSubmit).toBe(true)
    expect(validateLog({ ...base, duration: '4.5' }).errors.duration).toBeTruthy()
  })
  it('calories optional but bounded', () => {
    expect(validateLog({ ...base, calories: '450' }).canSubmit).toBe(true)
    expect(validateLog({ ...base, calories: '9000' }).errors.calories).toBeTruthy()
  })
  it('future date blocks', () => {
    expect(validateLog({ ...base, date: '2026-11-21' }).errors.date).toBeTruthy()
  })
  it('photo blocked or processing disables submit', () => {
    expect(validateLog({ ...base, photoBlocked: true }).canSubmit).toBe(false)
    const p = validateLog({ ...base, hasPhoto: false, processingPhoto: true })
    expect(p.canSubmit).toBe(false)
    expect(p.missing).not.toContain('la foto')
  })
})

describe('orderExerciseTypes', () => {
  const base = ['Correr', 'Caminar', 'Yoga', 'Otro']
  it('custom sports before Otro, most used first', () => {
    const ws = [{ exerciseType: ['Yoga'] }, { exerciseType: 'Yoga' }, { exerciseType: ['Surf', 'Caminar'] }]
    expect(orderExerciseTypes(base, ['Surf', 'correr'], ws)).toEqual(['Yoga', 'Caminar', 'Surf', 'Correr', 'Otro'])
  })
  it('keeps catalog order without history', () => {
    expect(orderExerciseTypes(base, [], [])).toEqual(base)
  })
})

describe('photoDateNote', () => {
  it('nothing when the date matches', () => {
    expect(photoDateNote({ valid: true, message: null, photoDate: TODAY }, TODAY, TODAY)).toBeNull()
    expect(photoDateNote(null, TODAY, TODAY)).toBeNull()
  })
  it('warning when unreadable or one day off', () => {
    expect(photoDateNote({ valid: true, message: 'x', photoDate: null }, TODAY, TODAY).tone).toBe('warn')
    const n = photoDateNote({ valid: true, message: 'x', photoDate: '2026-11-19' }, TODAY, TODAY)
    expect(n).toEqual({ tone: 'warn', text: 'La foto es de ayer. Es solo un día de diferencia, así que la aceptamos.' })
  })
  it('blocks on a mismatch', () => {
    const n = photoDateNote({ valid: false, message: 'x', photoDate: '2026-11-16' }, TODAY, TODAY)
    expect(n.tone).toBe('block')
    expect(n.text).toBe('La foto es del lunes 16 de noviembre y el ejercicio de hoy. Usa una foto de ese día o cambia la fecha.')
  })
})

describe('getLogCelebration', () => {
  it('celebrates completing the goal', () => {
    expect(getLogCelebration({ sessions: 2, goal: 3 }, TODAY, WEEK)).toEqual({ kind: 'met', sessions: 3, goal: 3, extras: 0 })
  })
  it('celebrates going beyond', () => {
    expect(getLogCelebration({ sessions: 3, goal: 3 }, TODAY, WEEK)).toEqual({ kind: 'extra', sessions: 4, goal: 3, extras: 1 })
  })
  it('no celebration before the goal', () => {
    expect(getLogCelebration({ sessions: 0, goal: 3 }, TODAY, WEEK)).toBeNull()
  })
  it('a workout dated in a past week never celebrates this week', () => {
    expect(getLogCelebration({ sessions: 2, goal: 3 }, '2026-11-15', WEEK)).toBeNull()
  })
})

describe('copy helpers', () => {
  it('successDescription', () => {
    expect(successDescription({ sessions: 1, goal: 3, date: TODAY, today: TODAY, currentWeekId: WEEK })).toBe('Llevas 1 de 3. Te faltan 2 sesiones.')
    expect(successDescription({ sessions: 2, goal: 3, date: TODAY, today: TODAY, currentWeekId: WEEK })).toBe('Llevas 2 de 3. Te falta 1 sesión.')
    expect(successDescription({ sessions: 1, goal: 3, date: '2026-11-15', today: TODAY, currentWeekId: WEEK })).toMatch(/^Quedó registrado el domingo 15 de noviembre/)
  })
  it('normalizeSportName', () => {
    expect(normalizeSportName('  surf   de remo ')).toBe('Surf de remo')
    expect(normalizeSportName('   ')).toBe('')
  })
  it('joinEs and parseIntField', () => {
    expect(joinEs(['a'])).toBe('a')
    expect(joinEs(['a', 'b'])).toBe('a y b')
    expect(parseIntField('')).toBeNull()
    expect(Number.isNaN(parseIntField('4x'))).toBe(true)
    expect(parseIntField(' 45 ')).toBe(45)
  })
})

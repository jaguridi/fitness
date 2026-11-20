/**
 * Copy and small decisions for the "Hoy" screen. Pure (no React, no I/O) so
 * every case of the headline can be tested.
 *
 * All functions take a member week as returned by getMemberWeek() (see
 * src/data/selectors.js): { sessions, goal, met, rest, remaining, extras,
 * daysLeft, daysTrained, closed, streak }.
 */

/** "1 sesión" / "3 sesiones". */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

const sesiones = (n) => plural(n, 'sesión', 'sesiones')
const semanas = (n) => plural(n, 'semana', 'semanas')
const falta = (n) => (n === 1 ? 'falta' : 'faltan')

/**
 * The headline of "Hoy": the status of the week, written as a sentence.
 * @param {object} w member week
 * @returns {{ title: string, tone: 'done'|'rest'|'todo' }}
 */
export function getHeadline(w) {
  const { sessions = 0, goal = 3, met = false, rest = false, extras = 0 } = w || {}
  const remaining = Math.max(0, goal - sessions)
  const daysLeft = w?.daysLeft ?? 7

  if (met && extras > 0) {
    return { title: `Semana lograda, y vas con ${sesiones(extras)} extra`, tone: 'done' }
  }
  if (met) return { title: '¡Semana lograda!', tone: 'done' }
  if (rest) {
    return {
      title: sessions > 0 ? 'Semana de descanso, y aun así te moviste' : 'Esta semana te toca descansar',
      tone: 'rest',
    }
  }
  if (sessions === 0) {
    if (daysLeft >= 7) {
      return { title: `Semana nueva: tu meta ${goal === 1 ? 'es' : 'son'} ${sesiones(goal)}`, tone: 'todo' }
    }
    if (daysLeft <= 1) return { title: `Hoy es el último día: te ${falta(remaining)} ${sesiones(remaining)}`, tone: 'todo' }
    if (daysLeft <= 3) return { title: `Todavía estás a tiempo: te ${falta(remaining)} ${sesiones(remaining)}`, tone: 'todo' }
    return { title: `Te ${falta(remaining)} ${sesiones(remaining)} para lograr la semana`, tone: 'todo' }
  }
  if (daysLeft <= 1) return { title: `Hoy es el último día: te ${falta(remaining)} ${sesiones(remaining)}`, tone: 'todo' }
  return { title: `Te ${falta(remaining)} ${sesiones(remaining)} para lograr la semana`, tone: 'todo' }
}

/**
 * The quiet line under the headline: streak and days left.
 * @param {object} w member week (with `streak`)
 * @returns {{ text: string, flame: boolean }}
 */
export function getSubline(w) {
  const { met = false, rest = false, streak = 0 } = w || {}
  const daysLeft = w?.daysLeft ?? 7
  const parts = []

  if (rest && !met) {
    parts.push(streak > 0 ? `Tu racha de ${semanas(streak)} queda intacta.` : 'No suma ni rompe tu racha.')
    return { text: parts.join(' '), flame: false }
  }

  if (streak > 0) parts.push(`Racha de ${semanas(streak)}.`)

  if (met) {
    parts.push(daysLeft <= 1 ? 'La semana cierra hoy a medianoche.' : 'La semana cierra el domingo.')
  } else if (daysLeft <= 1) {
    parts.push('La semana cierra a medianoche.')
  } else if (daysLeft >= 7) {
    parts.push('Tienes los 7 días por delante.')
  } else {
    parts.push(`Quedan ${daysLeft} días, contando hoy.`)
  }
  if (streak === 0 && !met) parts.unshift('Logra la semana para empezar tu racha.')
  return { text: parts.join(' '), flame: streak > 0 }
}

/**
 * Short status under a member's ring in "La familia esta semana".
 * @returns {{ text: string, tone: 'done'|'rest'|'todo' }}
 */
export function getMemberStatus(w) {
  if (!w) return { text: '', tone: 'todo' }
  if (w.met) return { text: w.extras > 0 ? `Lograda, +${w.extras}` : 'Lograda', tone: 'done' }
  if (w.rest) return { text: 'Descanso', tone: 'rest' }
  return { text: `${w.sessions} de ${w.goal}`, tone: 'todo' }
}

/**
 * True when a member could use an "empujón": the week is open, they are not
 * resting or done, they haven't trained today and they are behind a steady
 * pace (fewer sessions than goal × days already gone / 7). Never on Monday.
 * @param {object} w member week
 * @param {number} todayIdx 0 = Monday … 6 = Sunday
 */
export function isBehind(w, todayIdx) {
  if (!w || w.met || w.rest || w.closed || todayIdx < 0) return false
  if (w.daysTrained?.[todayIdx]) return false
  return w.sessions < (w.goal * todayIdx) / 7
}

/** Sessions per day (Mon..Sun) from a member week's workouts, for the WeekStrip. */
export function sessionsPerDay(workouts, weekDatesList) {
  return weekDatesList.map((d) => (workouts || []).filter((x) => x.date === d).length)
}

/**
 * The unearned sticker closest to completion (highest current/target ratio;
 * ties → fewer left, then lower album number). Stickers without measurable
 * progress are ignored.
 * @param {object[]} achievements from getAchievements()
 * @returns {object|null}
 */
export function pickNextSticker(achievements) {
  const candidates = (achievements || []).filter(
    (a) => !a.earned && !a.legacy && a.progress && a.progress.target > 0 && a.progress.current < a.progress.target
  )
  if (!candidates.length) return null
  const ratio = (a) => a.progress.current / a.progress.target
  const left = (a) => a.progress.target - a.progress.current
  return [...candidates].sort((a, b) => ratio(b) - ratio(a) || left(a) - left(b) || (a.number ?? 0) - (b.number ?? 0))[0]
}

/** Unit shown next to a goal's numbers. */
export function goalUnit(goal) {
  if (!goal) return ''
  if (goal.kind === 'manual') return goal.unit || ''
  return { sessions: 'sesiones', minutes: 'minutos', calories: 'kcal', habit: 'días' }[goal.metric] || ''
}

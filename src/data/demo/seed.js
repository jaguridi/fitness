/**
 * Demo seed — believable family data relative to "now", for `vite --mode demo`.
 * Deterministic (seeded PRNG): the same day always produces the same data.
 *
 * Personalities:
 *  - Jose (user1): very consistent, goal 3, one rest week (vacation).
 *  - Javi (user2): took a break (rest weeks), just came back strong.
 *  - Gonza (user3): streaky — good runs, then a couple of empty weeks.
 *  - Fran (user4): goal 2, trains a little, nails her habits.
 *
 * Only imported by backend.demo.js, which index.js loads dynamically, so none
 * of this ends up in the production bundle's main chunk.
 */
import { USERS } from '../../constants.js'
import { USER_IDS } from '../../game/constants.js'
import { getWeekId, getPreviousWeekId, getNextWeekId, getWeekRange } from '../../game/weekId.js'
import { formatYMD, weekDates, parseYMD, addDaysYMD } from '../../game/habits.js'
import { computeWeekClose } from '../../game/week.js'
import { evaluateAchievements } from '../../domain/achievements.js'

/** Minimal Firestore-Timestamp look-alike so UI code can call toMillis()/toDate(). */
export class DemoTimestamp {
  constructor(ms) {
    this.seconds = Math.floor(ms / 1000)
    this.nanoseconds = (ms % 1000) * 1e6
  }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  toDate() { return new Date(this.toMillis()) }
}
export const ts = (ms) => new DemoTimestamp(ms)

/** Mulberry32 PRNG. */
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEMO_PHOTOS = [
  '/demo/photo-1.svg', '/demo/photo-2.svg', '/demo/photo-3.svg', '/demo/photo-4.svg',
  '/demo/photo-5.svg', '/demo/photo-6.svg', '/demo/photo-7.svg', '/demo/photo-8.svg',
]

// Sessions per week, oldest → newest (12 closed weeks), then the current week.
// 'R' = rest week.
const PLANS = {
  user1: { goal: 3, weeks: [3, 3, 4, 'R', 3, 3, 3, 3, 4, 3, 3, 3], current: 2, days: [0, 2, 4, 5, 1, 3, 6], hour: 7 },
  user2: { goal: 3, weeks: [3, 2, 0, 'R', 'R', 'R', 'R', 0, 0, 1, 3, 3], current: 1, days: [1, 3, 5, 0, 2, 4, 6], hour: 19 },
  user3: { goal: 3, weeks: [3, 3, 0, 0, 3, 3, 3, 0, 1, 0, 3, 3], current: 1, days: [1, 3, 6, 5, 0, 2, 4], hour: 20 },
  user4: { goal: 2, weeks: [1, 1, 0, 1, 2, 0, 0, 2, 1, 0, 1, 2], current: 1, days: [2, 5, 6, 0, 1, 3, 4], hour: 18 },
}

const TYPES = {
  user1: ['Correr', 'Pesas', 'Bicicleta', 'Pádel', 'Natación'],
  user2: ['Yoga', 'Pilates', 'Caminar', 'Natación'],
  user3: ['Fútbol', 'Correr', 'CrossFit', 'Calistenia', 'Boxeo'],
  user4: ['Caminar', 'Baile', 'Spinning', 'Senderismo'],
}

// [min duration, max duration, kcal per minute]
const TYPE_PROFILE = {
  Correr: [30, 70, 10], Pesas: [40, 75, 6], Bicicleta: [45, 110, 8], 'Pádel': [60, 90, 7], 'Natación': [30, 60, 9],
  Yoga: [30, 60, 3], Pilates: [40, 55, 4], Caminar: [30, 80, 4], 'Fútbol': [60, 100, 9], CrossFit: [45, 60, 11],
  Calistenia: [30, 50, 7], Boxeo: [40, 60, 10], Baile: [45, 60, 6], Spinning: [40, 50, 10], Senderismo: [90, 180, 6],
}

const DESCRIPTIONS = {
  Correr: ['Trote suave por el parque', '5K con buen ritmo', 'Intervalos en la pista', 'Salida larga del domingo'],
  Pesas: ['Pierna y glúteo', 'Tren superior', 'Empuje: pecho y hombros', 'Espalda y bíceps'],
  Bicicleta: ['Vuelta al cerro', 'Ruta por la costanera', 'Pedaleo tranquilo con viento en contra'],
  'Pádel': ['Partido con los del trabajo', 'Dobles muy peleados', 'Clase de técnica'],
  'Natación': ['1.500 m libres', 'Series de 100 m', 'Piscina temprano, casi vacía'],
  Yoga: ['Vinyasa en casa', 'Clase de yoga restaurativo', 'Saludos al sol y respiración'],
  Pilates: ['Pilates mat', 'Reformer, clase intensa', 'Core y movilidad'],
  Caminar: ['Caminata con la perrita', 'Paseo largo al atardecer', 'Caminata rápida antes de la pega'],
  'Fútbol': ['Pichanga del jueves', 'Partido de la liga', 'Fútbol con amigos, ganamos'],
  CrossFit: ['WOD con burpees infinitos', 'Clase de CrossFit, murph adaptado', 'AMRAP de 20 minutos'],
  Calistenia: ['Dominadas y fondos en la plaza', 'Rutina de calistenia en casa'],
  Boxeo: ['Saco y cuerda', 'Clase de boxeo, guantes nuevos'],
  Baile: ['Zumba con mi amiga', 'Clase de salsa', 'Baile entretenido en el gimnasio'],
  Spinning: ['Spinning con playlist ochentera', 'Clase de spinning a full'],
  Senderismo: ['Subida al cerro Manquehue', 'Trekking en el cajón del Maipo', 'Sendero con vista a la ciudad'],
}

const COMMENTS = [
  '¡Bien ahí!', 'Qué buena foto', 'Imparable 💪', 'Esa es la actitud', '¿A qué hora te levantaste?',
  'La próxima voy contigo', 'Grande', 'Así se hace', 'Me motivaste, mañana salgo yo',
]
const REACTIONS = ['🔥', '💪', '👏', '😍', '🎉']

const HABITS = {
  user1: { weeksAgo: 10, rate: 0.78, list: [
    { name: 'Leer', emoji: '📚', targetPerWeek: 5 },
    { name: 'Tomar agua', emoji: '💧', targetPerWeek: 7 },
  ] },
  user2: { weeksAgo: 3, rate: 0.85, list: [
    { name: 'Meditar', emoji: '🧘', targetPerWeek: 7 },
    { name: 'Sin pantallas antes de dormir', emoji: '📵', targetPerWeek: 5 },
  ] },
  user3: { weeksAgo: 8, rate: 0.6, list: [
    { name: 'Dormir 7 h', emoji: '😴', targetPerWeek: 5 },
    { name: 'Sin azúcar', emoji: '🍬', targetPerWeek: 5, visibility: 'private' },
    { name: 'Correr en ayunas', emoji: '🌄', targetPerWeek: 2, archived: true, activeWeeks: 3 },
  ] },
  user4: { weeksAgo: 11, rate: 0.93, list: [
    { name: 'Leer', emoji: '📚', targetPerWeek: 7 },
    { name: 'Tomar agua', emoji: '💧', targetPerWeek: 7 },
    { name: 'Estirar', emoji: '🤸', targetPerWeek: 4 },
    { name: 'Escribir un diario', emoji: '✍️', targetPerWeek: 3 },
  ] },
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const name = (id) => USERS.find((u) => u.id === id)?.name || id

/** Short, neutral recap in the tone of the AI one. */
function buildRecap(results) {
  const done = results.filter((r) => r.status === 'completed')
  const rest = results.filter((r) => r.status === 'rest')
  const top = [...results].sort((a, b) => b.sessions - a.sessions)[0]
  const parts = []
  if (done.length === results.length) parts.push('¡Semana redonda: toda la familia logró su meta!')
  else if (done.length === 1) parts.push(`${name(done[0].userId)} logró la semana.`)
  else if (done.length) parts.push(`${done.length} de ${results.length} lograron la semana: ${done.map((r) => name(r.userId)).join(', ')}.`)
  else parts.push('Semana difícil para todos; la próxima parte de cero.')
  if (top?.sessions) parts.push(`${name(top.userId)} sumó ${top.sessions} sesiones, la mayor cantidad.`)
  const streaky = results.filter((r) => r.streak >= 3)
  if (streaky.length) parts.push(`Rachas encendidas: ${streaky.map((r) => `${name(r.userId)} (${r.streak})`).join(', ')}.`)
  if (rest.length) parts.push(`${rest.map((r) => name(r.userId)).join(' y ')} ${rest.length > 1 ? 'se tomaron' : 'se tomó'} la semana de descanso.`)
  return parts.join(' ')
}

/**
 * Build the whole demo dataset.
 * @param {Date} [now]
 * @returns {{ users, workouts, summaries, habits, habitWeeks, goals, unlocks, weekPosts,
 *   meta, customSports, weeklyRecaps }}  arrays of docs with `id`
 */
export function createDemoSeed(now = new Date()) {
  const rand = prng(20261116)
  const nowMs = now.getTime()
  const today = formatYMD(now)
  const currentWeekId = getWeekId(now)
  const todayIdx = weekDates(currentWeekId).indexOf(today)

  // 12 closed weeks + the current one, oldest first.
  const weeks = [currentWeekId]
  for (let i = 0; i < 12; i++) weeks.unshift(getPreviousWeekId(weeks[0]))
  const closedWeeks = weeks.slice(0, 12)

  // ── Users ──
  const users = USERS.map((u) => {
    const plan = PLANS[u.id]
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      weeklyGoal: plan.goal,
      restWeeks: plan.weeks.map((p, i) => (p === 'R' ? closedWeeks[i] : null)).filter(Boolean),
      prefs: { habitReminder: true },
      v2SeededAt: ts(nowMs - 20 * 86400000),
      pinHash: 'demo',
      pinSalt: 'demo',
    }
  })

  // ── Workouts ──
  const workouts = []
  let n = 0
  for (const uid of USER_IDS) {
    const plan = PLANS[uid]
    const counts = [...plan.weeks.map((p) => (p === 'R' ? 0 : p)), plan.current]
    counts.forEach((count, wi) => {
      const weekId = weeks[wi]
      const dates = weekDates(weekId)
      const isCurrent = weekId === currentWeekId
      const allowed = plan.days.filter((d) => !isCurrent || d <= todayIdx)
      // Rotate the preferred days a little so weeks don't look identical.
      const shift = Math.floor(rand() * 2)
      const chosen = [...allowed.slice(shift), ...allowed.slice(0, shift)].slice(0, Math.min(count, allowed.length)).sort()
      chosen.forEach((dayIdx, k) => {
        const date = dates[dayIdx]
        const types = TYPES[uid]
        const type = pick(rand, types)
        const exerciseType = rand() < 0.12 ? [type, pick(rand, types.filter((t) => t !== type))] : [type]
        const [lo, hi, kcal] = TYPE_PROFILE[type]
        const duration = Math.round((lo + rand() * (hi - lo)) / 5) * 5
        const calories = rand() < 0.7 ? Math.round((duration * kcal * (0.85 + rand() * 0.3)) / 10) * 10 : undefined
        const start = parseYMD(date)
        start.setHours(plan.hour + (k % 2), Math.floor(rand() * 60))
        let created = start.getTime() + duration * 60000
        if (created > nowMs) created = nowMs - (n % 5 + 1) * 17 * 60000
        const w = {
          id: `demo-w${String(++n).padStart(3, '0')}`,
          userId: uid,
          date,
          weekId,
          exerciseType,
          duration,
          description: pick(rand, DESCRIPTIONS[type]),
          createdAt: ts(created),
        }
        if (calories) w.calories = calories
        w.photoURL = DEMO_PHOTOS[(n * 3) % DEMO_PHOTOS.length] // the photo is mandatory
        // Social life on the last ~3 weeks.
        if (wi >= weeks.length - 4) {
          const others = USER_IDS.filter((id) => id !== uid)
          const reactions = {}
          for (const o of others) if (rand() < 0.45) reactions[o] = pick(rand, REACTIONS)
          if (Object.keys(reactions).length) w.reactions = reactions
          if (rand() < 0.28) {
            w.comments = [{ userId: pick(rand, others), text: pick(rand, COMMENTS), createdAt: created + 45 * 60000 }]
          }
        }
        workouts.push(w)
      })
    })
  }
  workouts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

  // ── Habits + checks ──
  const habits = []
  const habitWeeksById = {}
  for (const uid of USER_IDS) {
    const cfg = HABITS[uid]
    const startWeek = weeks[weeks.length - 1 - cfg.weeksAgo]
    const created = getWeekRange(startWeek).start.getTime() + 9 * 3600000
    cfg.list.forEach((h, i) => {
      const habit = {
        id: `demo-h-${uid}-${i + 1}`,
        userId: uid,
        name: h.name,
        emoji: h.emoji,
        targetPerWeek: h.targetPerWeek,
        visibility: h.visibility || 'family',
        archived: !!h.archived,
        order: i,
        createdAt: ts(created),
      }
      habits.push(habit)
      let wk = startWeek
      for (let w = 0; w <= cfg.weeksAgo; w++, wk = getNextWeekId(wk)) {
        if (h.activeWeeks != null && w >= h.activeWeeks) break
        const docId = `${uid}_${wk}`
        const hw = (habitWeeksById[docId] ||= { id: docId, userId: uid, weekId: wk, checks: {} })
        const dates = weekDates(wk).filter((d) => d <= today)
        const rate = cfg.rate * (h.targetPerWeek < 7 ? h.targetPerWeek / 7 + 0.12 : 1)
        const checked = dates.filter((d) => rand() < (d === today ? rate * 0.5 : rate))
        if (checked.length) hw.checks[habit.id] = checked
      }
    })
  }
  const habitWeeks = Object.values(habitWeeksById).map((hw) => ({ ...hw, updatedAt: ts(nowMs - 3600000) }))


  // ── Personal goals ──
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEnd = formatYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const at9 = (date) => { const d = parseYMD(date); d.setHours(9); return Math.min(d.getTime(), nowMs - 3600000) }
  // Gonza's achieved goal: minutes over the last 3 closed weeks.
  const gStart = weekDates(closedWeeks[closedWeeks.length - 3])[0]
  const gEnd = weekDates(closedWeeks[closedWeeks.length - 1])[6]
  const gonzaRange = workouts.filter((w) => w.userId === 'user3' && w.date >= gStart && w.date <= gEnd)
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
  const gTarget = Math.max(30, Math.floor((gonzaRange.reduce((s, w) => s + w.duration, 0) * 0.9) / 10) * 10)
  let acc = 0
  const crossing = gonzaRange.find((w) => (acc += w.duration) >= gTarget)
  const goals = [
    { id: 'demo-g1', userId: 'user1', title: '12 sesiones este mes', emoji: '👟', kind: 'auto', metric: 'sessions', target: 12,
      startDate: monthStart, endDate: monthEnd, reward: 'Zapatillas nuevas para correr', visibility: 'family', status: 'active',
      createdAt: ts(at9(monthStart)) },
    { id: 'demo-g2', userId: 'user1', title: 'Correr 100 km', emoji: '🏃', kind: 'manual', target: 100, unit: 'km', progress: 64,
      startDate: addDaysYMD(today, -40), endDate: addDaysYMD(today, 40), visibility: 'family', status: 'active',
      createdAt: ts(at9(addDaysYMD(today, -40))) },
    { id: 'demo-g3', userId: 'user2', title: 'Meditar 15 días este mes', emoji: '🧘', kind: 'auto', metric: 'habit',
      habitId: 'demo-h-user2-1', target: 15, startDate: monthStart, endDate: monthEnd,
      reward: 'Una clase de yoga en la playa', visibility: 'family', status: 'active', createdAt: ts(at9(monthStart)) },
    { id: 'demo-g4', userId: 'user2', title: 'Leer 4 libros', emoji: '📖', kind: 'manual', target: 4, unit: 'libros', progress: 1,
      startDate: addDaysYMD(today, -10), endDate: addDaysYMD(today, 60), visibility: 'private', status: 'active',
      createdAt: ts(at9(addDaysYMD(today, -10))) },
    { id: 'demo-g5', userId: 'user3', title: `${gTarget} minutos en 3 semanas`, emoji: '⚽', kind: 'auto', metric: 'minutes',
      target: gTarget, startDate: gStart, endDate: gEnd, reward: 'Una pichanga con asado', visibility: 'family',
      status: crossing ? 'achieved' : 'active', createdAt: ts(at9(gStart)),
      ...(crossing ? { achievedAt: ts(crossing.createdAt.toMillis() + 60000) } : {}),
      reactions: { user1: '🔥', user4: '👏' },
      comments: [{ userId: 'user2', text: '¡Te ganaste ese asado!', createdAt: (crossing ? crossing.createdAt.toMillis() : at9(gEnd)) + 3 * 3600000 }] },
    { id: 'demo-g6', userId: 'user4', title: 'Leer 20 días este mes', emoji: '📚', kind: 'auto', metric: 'habit',
      habitId: 'demo-h-user4-1', target: 20, startDate: monthStart, endDate: monthEnd, reward: 'Un día de spa',
      visibility: 'family', status: 'active', createdAt: ts(at9(monthStart)) },
  ]

  // ── Week closes (run the real close, week by week) ──
  let summaries = []
  const weekPosts = []
  const weeklyRecaps = []
  for (const weekId of closedWeeks) {
    const out = computeWeekClose({ weekId, userIds: USER_IDS, users, workouts, habits, habitWeeks, summaries, goals })
    for (const { goalId, data } of out.goalUpdates) Object.assign(goals.find((g) => g.id === goalId), data)
    const closedAt = getWeekRange(weekId).end.getTime() + 11 * 60000 // Monday 00:10
    summaries = [...summaries, ...out.summaries.map(({ data }) => ({
      id: `${data.userId}_${weekId}`, ...data, updatedAt: ts(closedAt),
    }))]
    if (weekId >= closedWeeks[closedWeeks.length - 4]) {
      const recap = buildRecap(out.weekPost.data.results)
      const post = { id: weekId, ...out.weekPost.data, recap, createdAt: ts(closedAt), reactions: {}, comments: [] }
      for (const uid of USER_IDS) if (rand() < 0.6) post.reactions[uid] = pick(rand, ['👏', '🔥', '💪', '🎉'])
      if (rand() < 0.7) post.comments.push({ userId: pick(rand, USER_IDS), text: pick(rand, ['¡Vamos por otra así!', 'Esta semana sí que sí', 'Bien familia 👏']), createdAt: closedAt + 8 * 3600000 })
      weekPosts.push(post)
      weeklyRecaps.push({ id: weekId, weekId, recap, createdAt: ts(closedAt) })
    }
  }

  // ── Sticker unlocks ──
  // Everything earned is "seeded" (silent), except the two most recent of
  // each member, which appear in the feed. Jose keeps one earned sticker
  // unrecorded so the "pegar la lámina" flow has something to celebrate.
  const unlocks = []
  for (const uid of USER_IDS) {
    const ctx = {
      userId: uid,
      user: users.find((u) => u.id === uid),
      workouts: workouts.filter((w) => w.userId === uid),
      summaries: summaries.filter((s) => s.userId === uid),
      habits: habits.filter((h) => h.userId === uid),
      habitWeeks: habitWeeks.filter((hw) => hw.userId === uid),
      allWorkouts: workouts,
      allSummaries: summaries,
      weekPosts,
      goals: goals.filter((g) => g.userId === uid),
      weekId: currentWeekId,
      today,
    }
    const earned = evaluateAchievements(ctx).filter((a) => a.earned).sort((a, b) => a.number - b.number)
    const pending = uid === 'user1' ? earned.slice(-1) : []
    const recordable = earned.filter((a) => !pending.includes(a))
    const recent = recordable.slice(-2)
    recordable.forEach((def) => {
      const isRecent = recent.includes(def)
      const createdMs = isRecent ? nowMs - (2 + recent.indexOf(def) * 3 + USER_IDS.indexOf(uid)) * 86400000 + 5 * 3600000 : new Date(2020, 0, 1).getTime()
      const u = {
        id: `${uid}_${def.id}`,
        userId: uid,
        achievementId: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        rarity: def.rarity,
        number: def.number,
        createdAt: ts(createdMs),
      }
      if (!isRecent) u.seeded = true
      else u.reactions = Object.fromEntries(USER_IDS.filter((o) => o !== uid && rand() < 0.5).map((o) => [o, '🎉']))
      unlocks.push(u)
    })
  }

  return {
    users,
    workouts,
    summaries,
    habits,
    habitWeeks,
    unlocks,
    weekPosts,
    goals,
    // v1 lock deliberately not parked: the provider parks it on start (in memory).
    meta: { lastAutoProcessedWeekId: closedWeeks[closedWeeks.length - 1], v2LastClosedWeekId: closedWeeks[closedWeeks.length - 1] },
    customSports: ['Kayak'],
    weeklyRecaps,
  }
}

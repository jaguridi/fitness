/**
 * Demo backend — in-memory implementation of the exact Backend interface of
 * backend.firebase.js (see ./index.js). Used by `vite --mode demo`
 * (VITE_DEMO=1): nothing leaves the browser, no push is ever sent.
 *
 * Subscriptions fire immediately with the current data and again after every
 * mutation. Data is regenerated from the seed on every page load.
 */
import { createDemoSeed, ts, DEMO_PHOTOS } from './demo/seed.js'
import { V2_START_WEEK, V1_LOCK_PARKED } from '../game/constants.js'
import { getPreviousWeekId } from '../game/weekId.js'

const COLLECTIONS = ['users', 'workouts', 'weekly_summaries', 'habits', 'habit_weeks', 'achievement_unlocks', 'week_posts', 'goals']
const TARGET_COLLECTION = { workout: 'workouts', unlock: 'achievement_unlocks', weekPost: 'week_posts', goal: 'goals' }
const NUDGE_COOLDOWN_MS = 30 * 60 * 1000
const tick = () => new Promise((r) => setTimeout(r, 0))
const isPlain = (v) => v != null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

/**
 * Create an isolated in-memory backend.
 * @param {{ now?: Date, seed?: object }} [opts]
 */
export function createDemoBackend({ now = new Date(), seed = createDemoSeed(now) } = {}) {
  /** @type {Record<string, Map<string, object>>} */
  const db = {}
  const load = (name, list) => { db[name] = new Map(list.map((d) => [d.id, { ...d }])) }
  load('users', seed.users)
  load('workouts', seed.workouts)
  load('weekly_summaries', seed.summaries)
  load('habits', seed.habits)
  load('habit_weeks', seed.habitWeeks)
  load('achievement_unlocks', seed.unlocks)
  load('week_posts', seed.weekPosts)
  load('goals', seed.goals || [])
  load('weekly_recaps', seed.weeklyRecaps || [])
  load('monthly_recaps', [])
  let meta = { ...seed.meta }
  let customSports = [...(seed.customSports || [])]
  let idCounter = 0
  const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${++idCounter}`

  const listeners = Object.fromEntries([...COLLECTIONS, 'customSports'].map((c) => [c, new Set()]))

  const sorters = {
    workouts: (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0) || (b.date || '').localeCompare(a.date || ''),
    habits: (a, b) => (a.order ?? 0) - (b.order ?? 0),
  }
  const snapshot = (name) => {
    const list = [...db[name].values()].map((d) => ({ ...d }))
    return sorters[name] ? list.sort(sorters[name]) : list
  }
  const emit = (name) => {
    const data = name === 'customSports' ? [...customSports] : snapshot(name)
    for (const cb of listeners[name]) cb(data)
  }
  const subscribe = (name) => (cb) => {
    listeners[name].add(cb)
    cb(name === 'customSports' ? [...customSports] : snapshot(name))
    return () => listeners[name].delete(cb)
  }
  /** Shallow-merge `data` into db[name][id] (creating it) and notify. */
  const merge = (name, id, data) => {
    const prev = db[name].get(id) || { id }
    db[name].set(id, { ...prev, ...clean(data), id })
    emit(name)
    return db[name].get(id)
  }
  const get = (name, id) => db[name].get(id)
  const nowTs = () => ts(Date.now())

  function targetDoc(target) {
    const col = TARGET_COLLECTION[target?.kind]
    const d = col && get(col, target.id)
    if (!d) throw new Error(`No existe ${target?.kind} ${target?.id}`)
    return [col, d]
  }

  const api = {
    kind: 'demo',

    // ── Subscriptions ──
    subscribeUsers: subscribe('users'),
    subscribeWorkouts: subscribe('workouts'),
    subscribeSummaries: subscribe('weekly_summaries'),
    subscribeHabits: subscribe('habits'),
    subscribeHabitWeeks: subscribe('habit_weeks'),
    subscribeUnlocks: subscribe('achievement_unlocks'),
    subscribeWeekPosts: subscribe('week_posts'),
    subscribeGoals: subscribe('goals'),
    subscribeCustomSports: subscribe('customSports'),

    // ── Users ──
    async getUsers() { await tick(); return snapshot('users') },
    async getUser(userId) { await tick(); const u = get('users', userId); return u ? { ...u } : null },
    async setUser(userId, data, { remove = [] } = {}) {
      await tick()
      const next = { ...(get('users', userId) || { id: userId }) }
      for (const [k, v] of Object.entries(clean(data))) {
        next[k] = isPlain(v) && isPlain(next[k])
          ? { ...next[k], ...v } // nested merge, like setDoc(..., { merge: true })
          : v
      }
      for (const f of remove) delete next[f]
      db.users.set(userId, next)
      emit('users')
    },
    async setRestWeek(userId, weekId, on) {
      await tick()
      const u = get('users', userId) || { id: userId }
      const set = new Set(u.restWeeks || [])
      if (on) set.add(weekId); else set.delete(weekId)
      merge('users', userId, { restWeeks: [...set] })
    },
    async addFcmToken(userId, token) {
      await tick()
      const u = get('users', userId) || {}
      merge('users', userId, { fcmToken: token, fcmTokens: [...new Set([...(u.fcmTokens || []), token])] })
    },

    // ── Workouts ──
    async uploadWorkoutPhoto(file) {
      await tick()
      if (typeof URL !== 'undefined' && URL.createObjectURL && typeof Blob !== 'undefined' && file instanceof Blob) {
        return URL.createObjectURL(file)
      }
      return DEMO_PHOTOS[idCounter % DEMO_PHOTOS.length]
    },
    async addWorkout(workout, photoFile = null) {
      if (!photoFile && !workout.photoURL) throw new Error('La foto es obligatoria.')
      const photoURL = photoFile ? await api.uploadWorkoutPhoto(photoFile, workout.userId, workout.date) : workout.photoURL
      await tick()
      const id = newId('demo-w')
      merge('workouts', id, { ...workout, photoURL, createdAt: nowTs() })
      return { id, photoURL }
    },
    async updateWorkout(workoutId, updates) {
      await tick()
      if (!get('workouts', workoutId)) throw new Error('No existe ese ejercicio.')
      const next = { ...get('workouts', workoutId) }
      for (const k of ['duration', 'calories', 'description', 'exerciseType', 'photoURL']) {
        if (!(k in updates)) continue
        if (updates[k] == null) delete next[k]; else next[k] = updates[k]
      }
      db.workouts.set(workoutId, next)
      emit('workouts')
    },
    async deleteWorkout(workoutId) {
      await tick()
      db.workouts.delete(workoutId)
      emit('workouts')
    },

    // ── Reactions & comments ──
    async setReaction(target, userId, emoji) {
      await tick()
      const [col, d] = targetDoc(target)
      const reactions = { ...(d.reactions || {}) }
      if (emoji) reactions[userId] = emoji; else delete reactions[userId]
      merge(col, d.id, { reactions })
    },
    async addComment(target, userId, text) {
      await tick()
      const [col, d] = targetDoc(target)
      const comment = { userId, text: String(text).trim(), createdAt: Date.now() }
      merge(col, d.id, { comments: [...(d.comments || []), comment] })
      return comment
    },

    // ── Habits ──
    async saveHabit(habit) {
      await tick()
      if (habit.id && get('habits', habit.id)) {
        const patch = {}
        for (const k of ['name', 'emoji', 'targetPerWeek', 'visibility', 'archived', 'order']) if (k in habit) patch[k] = habit[k]
        merge('habits', habit.id, patch)
        return habit.id
      }
      const id = newId('demo-h')
      merge('habits', id, {
        userId: habit.userId, name: habit.name, emoji: habit.emoji || '✅', targetPerWeek: habit.targetPerWeek,
        visibility: habit.visibility || 'family', archived: false, order: habit.order ?? 0, createdAt: nowTs(),
      })
      return id
    },
    async archiveHabit(habitId, archived = true) {
      await tick()
      merge('habits', habitId, { archived })
    },
    async reorderHabits(orderedIds) {
      await tick()
      orderedIds.forEach((id, i) => { const h = get('habits', id); if (h) db.habits.set(id, { ...h, order: i }) })
      emit('habits')
    },
    async toggleHabitCheck(userId, weekId, habitId, date, on) {
      await tick()
      const id = `${userId}_${weekId}`
      const hw = get('habit_weeks', id) || { id, userId, weekId, checks: {} }
      const set = new Set(hw.checks?.[habitId] || [])
      if (on) set.add(date); else set.delete(date)
      merge('habit_weeks', id, { userId, weekId, checks: { ...(hw.checks || {}), [habitId]: [...set].sort() }, updatedAt: nowTs() })
    },

    // ── Goals ──
    async saveGoal(goal) {
      await tick()
      const fields = ['title', 'emoji', 'kind', 'metric', 'exerciseType', 'habitId', 'target', 'unit', 'progress',
        'startDate', 'endDate', 'reward', 'visibility']
      if (goal.id && get('goals', goal.id)) {
        const next = { ...get('goals', goal.id) }
        for (const k of fields) {
          if (!(k in goal)) continue
          if (goal[k] === undefined || goal[k] === null || goal[k] === '') delete next[k]; else next[k] = goal[k]
        }
        db.goals.set(goal.id, next)
        emit('goals')
        return goal.id
      }
      const id = newId('demo-g')
      const data = { userId: goal.userId, visibility: 'family' }
      for (const k of fields) if (goal[k] !== undefined && goal[k] !== null && goal[k] !== '') data[k] = goal[k]
      merge('goals', id, { ...data, status: 'active', createdAt: nowTs() })
      return id
    },
    async updateGoalProgress(goalId, progress) {
      await tick()
      merge('goals', goalId, { progress: Math.max(0, Number(progress) || 0) })
    },
    async markGoalAchieved(goalId) {
      await tick()
      const g = get('goals', goalId)
      if (!g || (g.status || 'active') !== 'active') return false
      merge('goals', goalId, { status: 'achieved', achievedAt: nowTs() })
      return true
    },
    async markGoalMissed(goalId) {
      await tick()
      const g = get('goals', goalId)
      if (!g || (g.status || 'active') !== 'active') return false
      merge('goals', goalId, { status: 'missed' })
      return true
    },
    async cancelGoal(goalId) {
      await tick()
      merge('goals', goalId, { status: 'cancelled' })
    },

    // ── Unlocks ──
    async recordUnlock(userId, def) {
      await tick()
      const id = `${userId}_${def.id}`
      if (get('achievement_unlocks', id)) return false
      merge('achievement_unlocks', id, {
        userId, achievementId: def.id, name: def.name, description: def.description, icon: def.icon,
        rarity: def.rarity, number: def.number, createdAt: nowTs(),
      })
      return true
    },
    async seedUnlocks(userId, defs) {
      await tick()
      let created = 0
      for (const def of defs) {
        const id = `${userId}_${def.id}`
        if (get('achievement_unlocks', id)) continue
        db.achievement_unlocks.set(id, {
          id, userId, achievementId: def.id, name: def.name, description: def.description, icon: def.icon,
          rarity: def.rarity, number: def.number, seeded: true, createdAt: ts(new Date(2020, 0, 1).getTime()),
        })
        created++
      }
      emit('achievement_unlocks')
      merge('users', userId, { v2SeededAt: nowTs() })
      return created
    },

    // ── Week close outputs ──
    async setWeeklySummary(userId, weekId, data) {
      await tick()
      merge('weekly_summaries', `${userId}_${weekId}`, { ...data, userId, weekId, updatedAt: nowTs() })
    },
    async setWeekPost(weekId, data) {
      await tick()
      const { reactions, comments, createdAt, ...rest } = data // eslint-disable-line no-unused-vars
      const exists = !!get('week_posts', weekId)
      merge('week_posts', weekId, { ...rest, weekId, updatedAt: nowTs(), ...(exists ? {} : { createdAt: nowTs(), reactions: {}, comments: [] }) })
    },

    // ── Lock (v2LastClosedWeekId / v2Processing, like backend.firebase.js) ──
    async getAppMeta() { await tick(); return { ...meta } },
    async claimWeekProcessing(weekId) {
      await tick()
      const last = meta.v2LastClosedWeekId || getPreviousWeekId(V2_START_WEEK)
      if (last >= weekId) return false
      if (meta.v2Processing?.weekId === weekId) return false
      meta = { ...meta, v2Processing: { weekId, startedAt: Date.now() } }
      return true
    },
    async completeWeekProcessing(weekId) {
      await tick()
      const { v2Processing, ...rest } = meta // eslint-disable-line no-unused-vars
      meta = { ...rest, v2LastClosedWeekId: weekId }
    },
    async parkV1FinesLock() {
      await tick()
      if (meta.lastAutoProcessedWeekId === V1_LOCK_PARKED) return false
      meta = { ...meta, lastAutoProcessedWeekId: V1_LOCK_PARKED, v1LastProcessedWeekId: meta.lastAutoProcessedWeekId ?? null, v1FinesDisabledAt: Date.now() }
      return true
    },

    // ── Custom sports ──
    async addCustomSport(name) {
      await tick()
      if (!customSports.includes(name)) customSports = [...customSports, name]
      emit('customSports')
    },

    // ── Callables (canned) ──
    nudgeCooldownMinutes(targetUserId, at = Date.now()) {
      try {
        const last = parseInt(localStorage.getItem(`demo_nudge_${targetUserId}`) || '0', 10)
        const left = NUDGE_COOLDOWN_MS - (at - last)
        return left > 0 ? Math.ceil(left / 60000) : 0
      } catch {
        return 0
      }
    },
    async sendNudge(targetUserId, senderName) {
      const mins = api.nudgeCooldownMinutes(targetUserId)
      if (mins > 0) throw new Error(`Espera ${mins} min para enviar otro empujón.`)
      await tick()
      console.info(`[demo] empujón de ${senderName} a ${targetUserId}`)
      try { localStorage.setItem(`demo_nudge_${targetUserId}`, String(Date.now())) } catch { /* private mode */ }
      return { success: true, demo: true }
    },
    async getWeeklyRecap(weekId) {
      await tick()
      const stored = get('weekly_recaps', weekId)
      if (stored) return { ...stored }
      const recap = { id: weekId, weekId, recap: 'Semana movida en la familia: hubo sesiones, hábitos marcados y muchas reacciones. ¡A seguir así!', createdAt: nowTs() }
      db.weekly_recaps.set(weekId, recap)
      return { ...recap }
    },
    async getMonthlyRecap(monthId) {
      await tick()
      const stored = get('monthly_recaps', monthId)
      if (stored) return { ...stored }
      const recap = { id: monthId, monthId, recap: 'Un mes con constancia: Jose no soltó la racha, Javi volvió con todo, Gonza tuvo semanas brillantes y Fran fue la reina de los hábitos.', createdAt: nowTs() }
      db.monthly_recaps.set(monthId, recap)
      return { ...recap }
    },

    // ── Push (never real in demo) ──
    async registerPush(userId) {
      await api.addFcmToken(userId, 'demo-token')
      return 'demo-token'
    },
    async onForegroundMessage() { return () => {} },
  }
  return api
}

/** The page-wide demo backend instance. */
const demoBackend = createDemoBackend()
export default demoBackend

/**
 * Firebase backend — the ONLY module that talks to Firestore, Storage and
 * Cloud Functions. Implements the Backend interface documented in
 * ./index.js; backend.demo.js implements the same interface in memory.
 *
 * Read-only mode (`vite --mode readonly`, VITE_READONLY=1): reads hit the
 * real project but EVERY write (Firestore, Storage, callable) is a no-op that
 * console.info()s what it would have done and resolves with a plausible value.
 */
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, deleteField, arrayUnion, arrayRemove, runTransaction, writeBatch, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { db, storage } from '../firebase.js'
import { V2_START_WEEK, V1_LOCK_PARKED } from '../game/constants.js'
import { getPreviousWeekId } from '../game/weekId.js'

export const READONLY = import.meta.env.VITE_READONLY === '1'

/** Run `fn` unless read-only, in which case log and resolve `fallback`. */
async function write(name, args, fallback, fn) {
  if (READONLY) {
    console.info(`[solo lectura] ${name}`, ...args)
    return typeof fallback === 'function' ? fallback() : fallback
  }
  return fn()
}

/** Drop undefined values (Firestore rejects them). */
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

const withId = (d) => ({ id: d.id, ...d.data() })
const millis = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : 0)

/** onSnapshot over a whole collection, mapped to [{ id, ...data }]. */
function subscribeCollection(name, callback, onError, sort) {
  return onSnapshot(
    collection(db, name),
    (snap) => {
      const list = snap.docs.map(withId)
      callback(sort ? list.sort(sort) : list)
    },
    (err) => {
      // Read-only previews may run before the v2 rules are deployed, when the
      // new collections are still denied: treat those as empty instead of
      // failing, so v2 can be checked against real data ahead of the rollout.
      if (READONLY && err?.code === 'permission-denied') {
        console.info(`[solo lectura] ${name}: sin permiso de lectura todavía, se muestra vacío`)
        callback([])
        return
      }
      console.error(`subscribe ${name} error:`, err)
      onError?.(err)
    },
  )
}

// Targets that carry reactions/comments.
const TARGET_COLLECTION = { workout: 'workouts', unlock: 'achievement_unlocks', weekPost: 'week_posts', goal: 'goals' }
function targetRef(target) {
  const col = TARGET_COLLECTION[target?.kind]
  if (!col || !target.id) throw new Error(`Destino inválido: ${JSON.stringify(target)}`)
  return doc(db, col, target.id)
}

const fns = () => getFunctions(app)

// ── Subscriptions ────────────────────────────────────────────

export const subscribeUsers = (cb, onError) => subscribeCollection('users', cb, onError)

/** All workouts, newest first (createdAt, then date). */
export const subscribeWorkouts = (cb, onError) => subscribeCollection('workouts', cb, onError,
  (a, b) => millis(b.createdAt) - millis(a.createdAt) || (b.date || '').localeCompare(a.date || ''))

export const subscribeSummaries = (cb, onError) => subscribeCollection('weekly_summaries', cb, onError)
export const subscribeHabits = (cb, onError) => subscribeCollection('habits', cb, onError,
  (a, b) => (a.order ?? 0) - (b.order ?? 0))
export const subscribeHabitWeeks = (cb, onError) => subscribeCollection('habit_weeks', cb, onError)
export const subscribeUnlocks = (cb, onError) => subscribeCollection('achievement_unlocks', cb, onError)
export const subscribeWeekPosts = (cb, onError) => subscribeCollection('week_posts', cb, onError)
export const subscribeGoals = (cb, onError) => subscribeCollection('goals', cb, onError)

export function subscribeCustomSports(callback, onError) {
  return onSnapshot(
    doc(db, 'settings', 'customSports'),
    (snap) => callback(snap.exists() ? snap.data().list || [] : []),
    onError,
  )
}

// ── Users ────────────────────────────────────────────────────

export async function getUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(withId)
}

export async function getUser(userId) {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? withId(snap) : null
}

/**
 * Merge `data` into users/{userId}. `opts.remove` lists fields to delete
 * (e.g. the legacy plaintext `pin` after migrating it to a hash).
 */
export function setUser(userId, data, { remove = [] } = {}) {
  return write('setUser', [userId, data, remove], undefined, async () => {
    const payload = { ...clean(data) }
    for (const f of remove) payload[f] = deleteField()
    await setDoc(doc(db, 'users', userId), payload, { merge: true })
  })
}

/** Add or remove a weekId in users/{userId}.restWeeks. */
export function setRestWeek(userId, weekId, on) {
  return write('setRestWeek', [userId, weekId, on], undefined, () =>
    setDoc(doc(db, 'users', userId), { restWeeks: on ? arrayUnion(weekId) : arrayRemove(weekId) }, { merge: true }))
}

/** Register an FCM token (array for multi-device + legacy single field). */
export function addFcmToken(userId, token) {
  return write('addFcmToken', [userId, token], undefined, () =>
    setDoc(doc(db, 'users', userId), { fcmToken: token, fcmTokens: arrayUnion(token) }, { merge: true }))
}

// ── Workouts ─────────────────────────────────────────────────

/** Upload a workout photo to Storage and return its download URL. */
export function uploadWorkoutPhoto(file, userId, date) {
  return write('uploadWorkoutPhoto', [file?.name, userId, date],
    () => (typeof URL !== 'undefined' && URL.createObjectURL && file instanceof Blob ? URL.createObjectURL(file) : ''),
    async () => {
      const ext = (file.name || 'jpg').split('.').pop()
      const snapshot = await uploadBytes(ref(storage, `workouts/${userId}/${date}_${Date.now()}.${ext}`), file)
      return getDownloadURL(snapshot.ref)
    })
}

/**
 * Create a workout. The photo is mandatory: pass `photoFile` (uploaded first,
 * like v1) or an already-uploaded `workout.photoURL`.
 * @returns {Promise<{ id: string, photoURL: string }>}
 */
export async function addWorkout(workout, photoFile = null) {
  if (!photoFile && !workout.photoURL) throw new Error('La foto es obligatoria.')
  const photoURL = photoFile ? await uploadWorkoutPhoto(photoFile, workout.userId, workout.date) : workout.photoURL
  return write('addWorkout', [workout], { id: `readonly-${Date.now()}`, photoURL }, async () => {
    const created = await addDoc(collection(db, 'workouts'), clean({ ...workout, photoURL, createdAt: serverTimestamp() }))
    return { id: created.id, photoURL }
  })
}

const EDITABLE_WORKOUT_FIELDS = ['duration', 'calories', 'description', 'exerciseType', 'photoURL']

/** Update whitelisted workout fields (duration, calories, description, exerciseType, photoURL). */
export function updateWorkout(workoutId, updates) {
  const payload = {}
  for (const k of EDITABLE_WORKOUT_FIELDS) if (k in updates) payload[k] = updates[k] ?? deleteField()
  return write('updateWorkout', [workoutId, updates], undefined, () => updateDoc(doc(db, 'workouts', workoutId), payload))
}

export function deleteWorkout(workoutId) {
  return write('deleteWorkout', [workoutId], undefined, () => deleteDoc(doc(db, 'workouts', workoutId)))
}

// ── Reactions & comments (workout | unlock | weekPost | goal) ─

/** Set `emoji` as userId's reaction on a target, or remove it with null. */
export function setReaction(target, userId, emoji) {
  return write('setReaction', [target, userId, emoji], undefined, () =>
    updateDoc(targetRef(target), { [`reactions.${userId}`]: emoji ? emoji : deleteField() }))
}

/** Append a comment { userId, text, createdAt: ms } to a target. */
export function addComment(target, userId, text) {
  const comment = { userId, text: String(text).trim(), createdAt: Date.now() }
  return write('addComment', [target, comment], comment, async () => {
    await updateDoc(targetRef(target), { comments: arrayUnion(comment) })
    return comment
  })
}

// ── Habits ───────────────────────────────────────────────────

const HABIT_FIELDS = ['name', 'emoji', 'targetPerWeek', 'visibility', 'archived', 'order']

/**
 * Create (no `id`) or update (with `id`) a habit.
 * @returns {Promise<string>} the habit id
 */
export function saveHabit(habit) {
  if (habit.id) {
    const payload = {}
    for (const k of HABIT_FIELDS) if (k in habit) payload[k] = habit[k]
    return write('saveHabit', [habit], habit.id, async () => {
      await updateDoc(doc(db, 'habits', habit.id), payload)
      return habit.id
    })
  }
  const data = clean({
    userId: habit.userId,
    name: habit.name,
    emoji: habit.emoji || '✅',
    targetPerWeek: habit.targetPerWeek,
    visibility: habit.visibility || 'family',
    archived: false,
    order: habit.order ?? 0,
    createdAt: serverTimestamp(),
  })
  return write('saveHabit', [data], `readonly-${Date.now()}`, async () => (await addDoc(collection(db, 'habits'), data)).id)
}

/** Archive (or restore) a habit. Habits are never deleted. */
export function archiveHabit(habitId, archived = true) {
  return write('archiveHabit', [habitId, archived], undefined, () => updateDoc(doc(db, 'habits', habitId), { archived }))
}

/** Persist a new order: `orderedIds[i]` gets order = i. */
export function reorderHabits(orderedIds) {
  return write('reorderHabits', [orderedIds], undefined, async () => {
    const batch = writeBatch(db)
    orderedIds.forEach((id, i) => batch.update(doc(db, 'habits', id), { order: i }))
    await batch.commit()
  })
}

/** Check (on=true) or uncheck a habit for a date in habit_weeks/{userId}_{weekId}. */
export function toggleHabitCheck(userId, weekId, habitId, date, on) {
  return write('toggleHabitCheck', [userId, weekId, habitId, date, on], undefined, () =>
    setDoc(doc(db, 'habit_weeks', `${userId}_${weekId}`), {
      userId,
      weekId,
      checks: { [habitId]: on ? arrayUnion(date) : arrayRemove(date) },
      updatedAt: serverTimestamp(),
    }, { merge: true }))
}

// ── Personal goals ───────────────────────────────────────────

const GOAL_FIELDS = ['title', 'emoji', 'kind', 'metric', 'exerciseType', 'habitId', 'target', 'unit', 'progress',
  'startDate', 'endDate', 'reward', 'visibility']

/**
 * Create (no `id`; starts 'active') or edit (with `id`) a goal. Empty or
 * undefined optional fields are removed on edit. Status changes go through
 * markGoalAchieved / markGoalMissed / cancelGoal.
 * @returns {Promise<string>} goal id
 */
export function saveGoal(goal) {
  if (goal.id) {
    const payload = {}
    for (const k of GOAL_FIELDS) {
      if (!(k in goal)) continue
      payload[k] = goal[k] === undefined || goal[k] === null || goal[k] === '' ? deleteField() : goal[k]
    }
    return write('saveGoal', [goal], goal.id, async () => {
      await updateDoc(doc(db, 'goals', goal.id), payload)
      return goal.id
    })
  }
  const data = { userId: goal.userId, visibility: 'family' }
  for (const k of GOAL_FIELDS) if (goal[k] !== undefined && goal[k] !== null && goal[k] !== '') data[k] = goal[k]
  data.status = 'active'
  data.createdAt = serverTimestamp()
  return write('saveGoal', [data], `readonly-${Date.now()}`, async () => (await addDoc(collection(db, 'goals'), data)).id)
}

/** Set the manual progress of a goal. */
export function updateGoalProgress(goalId, progress) {
  return write('updateGoalProgress', [goalId, progress], undefined, () =>
    updateDoc(doc(db, 'goals', goalId), { progress: Math.max(0, Number(progress) || 0) }))
}

/** Change an ACTIVE goal's status in a transaction; resolves true if it changed. */
function transitionGoal(name, goalId, patch) {
  return write(name, [goalId], true, () => runTransaction(db, async (tx) => {
    const r = doc(db, 'goals', goalId)
    const snap = await tx.get(r)
    if (!snap.exists() || (snap.data().status || 'active') !== 'active') return false
    tx.update(r, patch)
    return true
  }))
}

/** Mark a goal achieved (status + achievedAt), only once and only if still active. */
export const markGoalAchieved = (goalId) => transitionGoal('markGoalAchieved', goalId, { status: 'achieved', achievedAt: serverTimestamp() })

/** Mark a goal missed (weekly close), only if still active. */
export const markGoalMissed = (goalId) => transitionGoal('markGoalMissed', goalId, { status: 'missed' })

/** Cancel a goal (kept for history). */
export function cancelGoal(goalId) {
  return write('cancelGoal', [goalId], undefined, () => updateDoc(doc(db, 'goals', goalId), { status: 'cancelled' }))
}

// ── Achievement unlocks ──────────────────────────────────────

function unlockPayload(userId, def, extra = {}) {
  return clean({
    userId,
    achievementId: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    rarity: def.rarity,
    number: def.number,
    ...extra,
  })
}

/**
 * Record a newly earned sticker (doc id `{userId}_{achievementId}`, so
 * concurrent tabs dedupe). Resolves false when it already existed.
 */
export function recordUnlock(userId, def) {
  return write('recordUnlock', [userId, def.id], true, () => runTransaction(db, async (tx) => {
    const r = doc(db, 'achievement_unlocks', `${userId}_${def.id}`)
    if ((await tx.get(r)).exists()) return false
    tx.set(r, unlockPayload(userId, def, { createdAt: serverTimestamp() }))
    return true
  }))
}

/**
 * Silently register stickers already earned through history: `seeded: true`,
 * createdAt 2020-01-01 (so they never reach the feed), skipping existing docs,
 * and stamp users/{userId}.v2SeededAt. Resolves the number of docs created.
 */
export function seedUnlocks(userId, defs) {
  return write('seedUnlocks', [userId, defs.map((d) => d.id)], defs.length, () => runTransaction(db, async (tx) => {
    const refs = defs.map((def) => doc(db, 'achievement_unlocks', `${userId}_${def.id}`))
    const snaps = await Promise.all(refs.map((r) => tx.get(r)))
    const createdAt = Timestamp.fromDate(new Date(2020, 0, 1))
    let created = 0
    snaps.forEach((snap, i) => {
      if (snap.exists()) return
      tx.set(refs[i], unlockPayload(userId, defs[i], { seeded: true, createdAt }))
      created++
    })
    tx.set(doc(db, 'users', userId), { v2SeededAt: serverTimestamp() }, { merge: true })
    return created
  }))
}

// ── Week close outputs ───────────────────────────────────────

/** Write weekly_summaries/{userId}_{weekId} (merge, + updatedAt). */
export function setWeeklySummary(userId, weekId, data) {
  return write('setWeeklySummary', [userId, weekId, data], undefined, () =>
    setDoc(doc(db, 'weekly_summaries', `${userId}_${weekId}`), { ...data, userId, weekId, updatedAt: serverTimestamp() }, { merge: true }))
}

/**
 * Merge week_posts/{weekId}. Never touches reactions/comments; sets createdAt
 * only the first time so re-closing a week doesn't move it in the feed.
 */
export function setWeekPost(weekId, data) {
  const { reactions, comments, createdAt, ...rest } = data // eslint-disable-line no-unused-vars
  return write('setWeekPost', [weekId, rest], undefined, () => runTransaction(db, async (tx) => {
    const r = doc(db, 'week_posts', weekId)
    const exists = (await tx.get(r)).exists()
    tx.set(r, { ...rest, weekId, updatedAt: serverTimestamp(), ...(exists ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
  }))
}

// ── Week-close lock (settings/meta) ──────────────────────────
// The v2 close has its own lock: v2LastClosedWeekId + v2Processing (same
// claim protocol as v1 and the Cloud Function). A missing v2LastClosedWeekId
// means "the week before V2_START_WEEK", so nothing older ever gets closed.
// lastAutoProcessedWeekId (the v1 lock) is parked at '9999-W99' so the v1
// function and cached v1 clients never close (= fine) a week again.

const metaDoc = () => doc(db, 'settings', 'meta')
const CLAIM_TTL_MS = 5 * 60 * 1000
const v2Last = (meta) => meta.v2LastClosedWeekId || getPreviousWeekId(V2_START_WEEK)

export async function getAppMeta() {
  const snap = await getDoc(metaDoc())
  return snap.exists() ? snap.data() : {}
}

/** Atomically claim `weekId` for the v2 close. False if already closed or freshly claimed elsewhere. */
export function claimWeekProcessing(weekId) {
  // Read-only: never claim, so the client never runs a close.
  return write('claimWeekProcessing', [weekId], false, () => runTransaction(db, async (tx) => {
    const snap = await tx.get(metaDoc())
    const meta = snap.exists() ? snap.data() : {}
    if (v2Last(meta) >= weekId) return false
    const p = meta.v2Processing
    const startedAt = p?.startedAt?.toMillis?.() ?? 0
    if (p?.weekId === weekId && Date.now() - startedAt < CLAIM_TTL_MS) return false
    tx.set(metaDoc(), { v2Processing: { weekId, startedAt: serverTimestamp() } }, { merge: true })
    return true
  }))
}

/** Mark `weekId` closed (v2LastClosedWeekId) and release the claim. */
export function completeWeekProcessing(weekId) {
  return write('completeWeekProcessing', [weekId], undefined, () =>
    setDoc(metaDoc(), { v2LastClosedWeekId: weekId, v2Processing: deleteField() }, { merge: true }))
}

/**
 * Park the v1 lock at '9999-W99' (saving the old value in
 * v1LastProcessedWeekId + v1FinesDisabledAt) unless already parked.
 * Resolves true when it changed something.
 */
export function parkV1FinesLock() {
  return write('parkV1FinesLock', [], false, () => runTransaction(db, async (tx) => {
    const snap = await tx.get(metaDoc())
    const meta = snap.exists() ? snap.data() : {}
    if (meta.lastAutoProcessedWeekId === V1_LOCK_PARKED) return false
    tx.set(metaDoc(), {
      lastAutoProcessedWeekId: V1_LOCK_PARKED,
      v1LastProcessedWeekId: meta.lastAutoProcessedWeekId ?? null,
      v1FinesDisabledAt: serverTimestamp(),
    }, { merge: true })
    return true
  }))
}

// ── Custom sports ────────────────────────────────────────────

export function addCustomSport(name) {
  return write('addCustomSport', [name], undefined, () =>
    setDoc(doc(db, 'settings', 'customSports'), { list: arrayUnion(name) }, { merge: true }))
}

// ── Callables: nudge, recaps ─────────────────────────────────

const NUDGE_COOLDOWN_MS = 30 * 60 * 1000

/** Remaining nudge cooldown for a target, in minutes (0 = can nudge). */
export function nudgeCooldownMinutes(targetUserId, now = Date.now()) {
  try {
    const last = parseInt(localStorage.getItem(`nudge_${targetUserId}`) || '0', 10)
    const left = NUDGE_COOLDOWN_MS - (now - last)
    return left > 0 ? Math.ceil(left / 60000) : 0
  } catch {
    return 0
  }
}

/** Send a push "empujón" (30-min cooldown per target, kept in localStorage). */
export async function sendNudge(targetUserId, senderName) {
  const mins = nudgeCooldownMinutes(targetUserId)
  if (mins > 0) throw new Error(`Espera ${mins} min para enviar otro empujón.`)
  const data = await write('sendNudge', [targetUserId, senderName], { success: true, readonly: true }, async () =>
    (await httpsCallable(fns(), 'sendNudge')({ targetUserId, senderName })).data)
  if (!data?.success) throw new Error(data?.reason || 'No se pudo enviar el empujón.')
  try { localStorage.setItem(`nudge_${targetUserId}`, String(Date.now())) } catch { /* private mode */ }
  return data
}

/** Cached weekly AI recap, generating it via the `generateWeeklyRecap` callable if missing. */
export async function getWeeklyRecap(weekId) {
  const snap = await getDoc(doc(db, 'weekly_recaps', weekId))
  if (snap.exists()) return snap.data()
  return write('generateWeeklyRecap', [weekId], { weekId, recap: null, readonly: true }, async () =>
    (await httpsCallable(fns(), 'generateWeeklyRecap')({ weekId })).data)
}

/** Cached monthly AI recap ('yyyy-MM'), generating it via `generateMonthlyRecap` if missing. */
export async function getMonthlyRecap(monthId) {
  const snap = await getDoc(doc(db, 'monthly_recaps', monthId))
  if (snap.exists()) return snap.data()
  return write('generateMonthlyRecap', [monthId], { monthId, recap: null, readonly: true }, async () =>
    (await httpsCallable(fns(), 'generateMonthlyRecap')({ monthId })).data)
}

// ── Push ─────────────────────────────────────────────────────

/** Ask for notification permission and store the FCM token. Resolves the token or null. */
export async function registerPush(userId) {
  const { registerPushToken } = await import('./push.js')
  return registerPushToken(userId, addFcmToken)
}

/** Foreground push listener. Resolves an unsubscribe function. */
export async function onForegroundMessage(callback) {
  const push = await import('./push.js')
  return push.onForegroundMessage(callback)
}

export const kind = READONLY ? 'readonly' : 'firebase'

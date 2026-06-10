import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteField,
  arrayUnion,
  runTransaction,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, storage } from '../firebase'
import app from '../firebase'

// ── Collections ──────────────────────────────────────────────
const usersCol = () => collection(db, 'users')
const workoutsCol = () => collection(db, 'workouts')
const weeklySummariesCol = () => collection(db, 'weekly_summaries')
const absencesCol = () => collection(db, 'absences')
const flaggedWorkoutsCol = () => collection(db, 'flagged_workouts')

// ── Users ────────────────────────────────────────────────────
export async function getUsers() {
  const snap = await getDocs(usersCol())
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUser(userId) {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function setUser(userId, data) {
  await setDoc(doc(db, 'users', userId), data, { merge: true })
}

/**
 * Register an FCM token for a user. Tokens accumulate in the fcmTokens array
 * so phone + desktop can both receive pushes; the legacy single fcmToken field
 * is kept in sync for backwards compatibility. Cloud Functions read both and
 * prune dead tokens on send.
 */
export async function addFcmToken(userId, token) {
  await setDoc(doc(db, 'users', userId), {
    fcmToken: token,
    fcmTokens: arrayUnion(token),
  }, { merge: true })
}

export function subscribeUsers(callback, onError) {
  return onSnapshot(
    usersCol(),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeUsers error:', err)
      onError?.(err)
    }
  )
}

// ── Workouts ─────────────────────────────────────────────────
export async function addWorkout(workout) {
  return addDoc(workoutsCol(), {
    ...workout,
    createdAt: serverTimestamp(),
  })
}

export async function getWorkoutsForWeek(weekId) {
  const q = query(workoutsCol(), where('weekId', '==', weekId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getWorkoutsByUser(userId) {
  const q = query(
    workoutsCol(),
    where('userId', '==', userId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export function subscribeWorkoutsForWeek(weekId, callback, onError) {
  const q = query(workoutsCol(), where('weekId', '==', weekId))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeWorkoutsForWeek error:', err)
      onError?.(err)
    }
  )
}

// ── Weekly Summaries ─────────────────────────────────────────
// Document ID format: "userId_weekId" e.g. "user1_2025-W03"
export async function getWeeklySummary(userId, weekId) {
  const docId = `${userId}_${weekId}`
  const snap = await getDoc(doc(db, 'weekly_summaries', docId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function setWeeklySummary(userId, weekId, data) {
  const docId = `${userId}_${weekId}`
  await setDoc(doc(db, 'weekly_summaries', docId), {
    userId,
    weekId,
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function getAllSummariesForWeek(weekId) {
  const q = query(weeklySummariesCol(), where('weekId', '==', weekId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUserSummaries(userId) {
  const q = query(
    weeklySummariesCol(),
    where('userId', '==', userId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.weekId || '').localeCompare(a.weekId || ''))
}

export function subscribeWeeklySummaries(weekId, callback) {
  const q = query(weeklySummariesCol(), where('weekId', '==', weekId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ── Absences ─────────────────────────────────────────────────
export async function addAbsence(absence) {
  return addDoc(absencesCol(), {
    ...absence,
    createdAt: serverTimestamp(),
  })
}

export async function getAbsences(userId) {
  const q = query(absencesCol(), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getAllAbsences() {
  const snap = await getDocs(absencesCol())
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateAbsence(absenceId, data) {
  await updateDoc(doc(db, 'absences', absenceId), data)
}

export async function deleteAbsence(absenceId) {
  await deleteDoc(doc(db, 'absences', absenceId))
}

// ── All Workouts (Feed) ──────────────────────────────────────
export function subscribeAllWorkouts(callback, onError, maxItems = 50) {
  const q = query(workoutsCol(), orderBy('createdAt', 'desc'), limit(maxItems))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeAllWorkouts error:', err)
      onError?.(err)
    }
  )
}

// ── Justifications ────────────────────────────────────────────
const justificationsCol = () => collection(db, 'justifications')

export async function addJustification(justification) {
  return addDoc(justificationsCol(), {
    ...justification,
    createdAt: serverTimestamp(),
  })
}

export async function getJustification(userId, weekId) {
  const q = query(
    justificationsCol(),
    where('userId', '==', userId),
    where('weekId', '==', weekId)
  )
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export async function updateJustification(justificationId, data) {
  await updateDoc(doc(db, 'justifications', justificationId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function getJustificationsForWeek(weekId) {
  const q = query(justificationsCol(), where('weekId', '==', weekId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getAllJustifications() {
  const snap = await getDocs(justificationsCol())
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function subscribeJustifications(callback, onError) {
  const q = query(justificationsCol(), orderBy('createdAt', 'desc'), limit(20))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeJustifications error:', err)
      onError?.(err)
    }
  )
}

export async function uploadJustificationPhoto(file, userId, weekId) {
  const timestamp = Date.now()
  const ext = file.name.split('.').pop()
  const path = `justifications/${userId}/${weekId}_${timestamp}.${ext}`
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

/** Cast a vote on a pending justification. */
export async function voteOnJustification(justificationId, voterId, vote) {
  await updateDoc(doc(db, 'justifications', justificationId), {
    [`votes.${voterId}`]: vote, // 'approve' or 'reject'
    updatedAt: serverTimestamp(),
  })
}

/** Resolve a justification vote: count votes and set final verdict. */
export async function resolveJustificationVote(justificationId, votes, totalEligibleVoters) {
  const approves = Object.values(votes).filter((v) => v === 'approve').length
  const rejects = Object.values(votes).filter((v) => v === 'reject').length
  const totalVotes = approves + rejects

  // Need majority of eligible voters (everyone except the justification owner)
  const needed = Math.ceil(totalEligibleVoters / 2)

  if (approves >= needed) {
    await updateDoc(doc(db, 'justifications', justificationId), {
      aiVerdict: true,
      aiReason: `Aprobada por votación familiar (${approves} a favor, ${rejects} en contra).`,
      status: 'resolved',
      updatedAt: serverTimestamp(),
    })
    return 'approved'
  } else if (rejects >= needed) {
    await updateDoc(doc(db, 'justifications', justificationId), {
      aiVerdict: false,
      aiReason: `Rechazada por votación familiar (${rejects} en contra, ${approves} a favor).`,
      status: 'resolved',
      updatedAt: serverTimestamp(),
    })
    return 'rejected'
  }

  // Not enough votes yet
  return 'pending'
}

/** Real-time subscription to pending justification votes. */
export function subscribePendingJustifications(callback, onError) {
  const q = query(justificationsCol(), where('status', '==', 'pending_vote'))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribePendingJustifications error:', err)
      onError?.(err)
    }
  )
}

// ── Flagged Workouts (Flag & Vote) ───────────────────────────

/** Flag a workout for review. Doc ID = workoutId to prevent duplicates. */
export async function flagWorkout(workoutId, flaggedBy, workoutOwnerId) {
  const docRef = doc(db, 'flagged_workouts', workoutId)
  const existing = await getDoc(docRef)
  if (existing.exists()) {
    throw new Error('Este ejercicio ya fue reportado.')
  }
  await setDoc(docRef, {
    workoutId,
    flaggedBy,
    workoutOwnerId,
    status: 'pending',
    votes: { [flaggedBy]: 'fake' },
    createdAt: serverTimestamp(),
    resolvedAt: null,
  })
}

/** Cast a vote on a flagged workout. */
export async function voteOnFlag(workoutId, voterId, vote) {
  const docRef = doc(db, 'flagged_workouts', workoutId)
  await updateDoc(docRef, {
    [`votes.${voterId}`]: vote,
  })
}

/** Resolve a flag: set status + resolvedAt. */
export async function resolveFlag(workoutId, resolution) {
  const docRef = doc(db, 'flagged_workouts', workoutId)
  await updateDoc(docRef, {
    status: resolution,
    resolvedAt: serverTimestamp(),
  })
}

/** Delete a workout document (used when vote resolves to fake). */
export async function deleteWorkout(workoutId) {
  await deleteDoc(doc(db, 'workouts', workoutId))
}

/**
 * Update editable fields of a workout. The caller is responsible for enforcing
 * the 24h ownership window — Firestore rules can/should mirror this in prod.
 */
export async function updateWorkout(workoutId, updates) {
  // Only allow whitelisted fields to mutate (defense in depth).
  const allowed = ['duration', 'calories', 'description', 'exerciseType']
  const payload = {}
  for (const k of allowed) {
    if (k in updates) payload[k] = updates[k]
  }
  await updateDoc(doc(db, 'workouts', workoutId), payload)
}

/** Real-time subscription to all pending flags. */
export function subscribeFlaggedWorkouts(callback, onError) {
  const q = query(flaggedWorkoutsCol(), where('status', '==', 'pending'))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeFlaggedWorkouts error:', err)
      onError?.(err)
    }
  )
}

// ── Achievement Unlocks ─────────────────────────────────────
const achievementUnlocksCol = () => collection(db, 'achievement_unlocks')

/**
 * Record that a user unlocked an achievement. Doc ID is deterministic
 * (`{userId}_{achievementId}`) so concurrent writes from multiple tabs
 * naturally dedupe — if the achievement was already posted, this is a no-op.
 */
export async function recordAchievementUnlock(userId, achievementId, achievement) {
  const docId = `${userId}_${achievementId}`
  const ref = doc(db, 'achievement_unlocks', docId)
  const existing = await getDoc(ref)
  if (existing.exists()) return false
  await setDoc(ref, {
    userId,
    achievementId,
    name: achievement?.name || achievementId,
    description: achievement?.description || '',
    icon: achievement?.icon || '🏅',
    createdAt: serverTimestamp(),
  })
  return true
}

/** Subscribe to the most recent achievement unlocks (for the Feed). */
export function subscribeAchievementUnlocks(callback, onError, maxItems = 30) {
  const q = query(achievementUnlocksCol(), orderBy('createdAt', 'desc'), limit(maxItems))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('subscribeAchievementUnlocks error:', err)
      onError?.(err)
    }
  )
}

// ── Reactions ────────────────────────────────────────────────

/** Add or change a reaction on a workout. Stored as reactions.{userId} = emoji */
export async function addReaction(workoutId, userId, emoji) {
  await updateDoc(doc(db, 'workouts', workoutId), {
    [`reactions.${userId}`]: emoji,
  })
}

/** Remove a user's reaction from a workout. */
export async function removeReaction(workoutId, userId) {
  await updateDoc(doc(db, 'workouts', workoutId), {
    [`reactions.${userId}`]: deleteField(),
  })
}

// ── Comments ────────────────────────────────────────────────────

/**
 * Add a comment to a workout.
 * Comments are stored as an array field on the workout document.
 * Each comment: { userId, text, createdAt (ms timestamp) }
 * arrayUnion appends atomically — two simultaneous comments can't overwrite
 * each other (the old read-modify-write lost one of them).
 */
export async function addComment(workoutId, userId, text) {
  await updateDoc(doc(db, 'workouts', workoutId), {
    comments: arrayUnion({ userId, text: text.trim(), createdAt: Date.now() }),
  })
}

// ── Nudge ───────────────────────────────────────────────────────

const NUDGE_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes between nudges to same person

const sendNudgeFn = httpsCallable(getFunctions(app), 'sendNudge')

/**
 * Send a motivational nudge push notification to another user.
 * Has a 30-minute cooldown per target to prevent spam.
 */
export async function sendNudge(targetUserId, senderName) {
  const key = `nudge_${targetUserId}`
  const lastNudge = parseInt(localStorage.getItem(key) || '0', 10)
  const now = Date.now()

  if (now - lastNudge < NUDGE_COOLDOWN_MS) {
    const minsLeft = Math.ceil((NUDGE_COOLDOWN_MS - (now - lastNudge)) / 60000)
    throw new Error(`Espera ${minsLeft} min para enviar otro empujón.`)
  }

  const { data } = await sendNudgeFn({ targetUserId, senderName })
  if (!data.success) {
    throw new Error(data.reason || 'No se pudo enviar el empujón.')
  }

  localStorage.setItem(key, String(now))
  return data
}

// ── Weekly Recap ────────────────────────────────────────────────

const generateWeeklyRecapFn = httpsCallable(getFunctions(app), 'generateWeeklyRecap')

/**
 * Get or generate the AI-powered weekly recap for a given week.
 * Checks Firestore cache first, then calls Cloud Function if needed.
 */
export async function getWeeklyRecap(weekId) {
  // Check if recap already exists locally
  const docSnap = await getDoc(doc(db, 'weekly_recaps', weekId))
  if (docSnap.exists()) {
    return docSnap.data()
  }

  // Generate via Cloud Function
  const { data } = await generateWeeklyRecapFn({ weekId })
  return data
}

const generateMonthlyRecapFn = httpsCallable(getFunctions(app), 'generateMonthlyRecap')

/**
 * Get or generate the AI-powered monthly recap for a given month (YYYY-MM).
 */
export async function getMonthlyRecap(monthId) {
  const docSnap = await getDoc(doc(db, 'monthly_recaps', monthId))
  if (docSnap.exists()) {
    return docSnap.data()
  }
  const { data } = await generateMonthlyRecapFn({ monthId })
  return data
}

// ── App Meta (settings/meta) ──────────────────────────────────

const metaDoc = () => doc(db, 'settings', 'meta')

export async function getAppMeta() {
  const snap = await getDoc(metaDoc())
  return snap.exists() ? snap.data() : {}
}

export async function setAppMeta(data) {
  await setDoc(metaDoc(), data, { merge: true })
}

// ── Week-end processing lock ─────────────────────────────────
// Two devices opening the app at the same time used to both run the week-end
// close (double fines). A Firestore transaction now "claims" each week before
// processing: whoever wins the transaction processes it, everyone else skips.
// The scheduled Cloud Function uses the same protocol server-side.

const CLAIM_TTL_MS = 5 * 60 * 1000 // a crashed claimant's lock expires after 5 min

/**
 * Atomically claim `weekId` for processing.
 * Returns false if the week was already processed or another device holds a
 * fresh claim on it.
 */
export async function claimWeekProcessing(weekId) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(metaDoc())
    const meta = snap.exists() ? snap.data() : {}
    // Week ids ("2026-W23") compare correctly as strings.
    if ((meta.lastAutoProcessedWeekId || '') >= weekId) return false
    const p = meta.processing
    const startedAt = p?.startedAt?.toMillis?.() ?? 0
    if (p?.weekId === weekId && Date.now() - startedAt < CLAIM_TTL_MS) return false
    tx.set(metaDoc(), { processing: { weekId, startedAt: serverTimestamp() } }, { merge: true })
    return true
  })
}

/** Mark `weekId` as processed and release the claim. */
export async function completeWeekProcessing(weekId) {
  await setDoc(metaDoc(), {
    lastAutoProcessedWeekId: weekId,
    processing: deleteField(),
  }, { merge: true })
}

// ── Photo Upload ─────────────────────────────────────────────
export async function uploadWorkoutPhoto(file, userId, date) {
  const timestamp = Date.now()
  const ext = file.name.split('.').pop()
  const path = `workouts/${userId}/${date}_${timestamp}.${ext}`
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

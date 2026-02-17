import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

// ── Collections ──────────────────────────────────────────────
const usersCol = () => collection(db, 'users')
const workoutsCol = () => collection(db, 'workouts')
const weeklySummariesCol = () => collection(db, 'weekly_summaries')
const absencesCol = () => collection(db, 'absences')

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
    where('userId', '==', userId),
    orderBy('date', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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
    where('userId', '==', userId),
    orderBy('weekId', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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

// ── Photo Upload ─────────────────────────────────────────────
export async function uploadWorkoutPhoto(file, userId, date) {
  const timestamp = Date.now()
  const ext = file.name.split('.').pop()
  const path = `workouts/${userId}/${date}_${timestamp}.${ext}`
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

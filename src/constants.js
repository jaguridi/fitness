// The 4 family members
// avatarMoods: { happy, normal, sad } — image paths for mood-based avatars
// For emoji-based avatars, mood variants are optional
export const USERS = [
  {
    id: 'user1',
    name: 'Jose',
    avatar: '/avatars/jose.png',
    avatarMoods: {
      happy: '/avatars/jose_happy.png',
      normal: '/avatars/jose.png',
      sad: '/avatars/jose_sad.png',
    },
  },
  { id: 'user2', name: 'Javi', avatar: '🧘‍♀️' },
  { id: 'user3', name: 'Gonza', avatar: '🏃‍♂️' },
  {
    id: 'user4',
    name: 'Fran',
    avatar: '/avatars/fran.png',
    avatarMoods: {
      happy: '/avatars/fran_happy.png',
      normal: '/avatars/fran.png',
      sad: '/avatars/fran_sad.png',
    },
  },
]

/**
 * Mood-appropriate avatar for a member.
 * @param {object} userConst  entry from USERS
 * @param {'happy'|'normal'|'sad'} [mood='normal']  computed by the selectors
 *   (src/data/selectors.js → getMemberWeek().mood)
 * @returns {string} image path or emoji
 */
export function getAvatarForMood(userConst, mood = 'normal') {
  if (!userConst?.avatarMoods) return userConst?.avatar || '🏃'
  return userConst.avatarMoods[mood] || userConst.avatarMoods.normal || userConst.avatar
}

// Game rules live in src/game/constants.js (pure module shared with Cloud
// Functions); re-exported here for UI convenience.
export {
  DEFAULT_WEEKLY_GOAL,
  MIN_WEEKLY_GOAL,
  MAX_WEEKLY_GOAL,
  MIN_HABIT_TARGET,
  MAX_HABIT_TARGET,
  V2_START_WEEK,
} from './game/constants.js'

// Habit suggestions shown when creating a habit (name, emoji, days per week).
export const HABIT_SUGGESTIONS = [
  { name: 'Leer', emoji: '📚', targetPerWeek: 5 },
  { name: 'Meditar', emoji: '🧘', targetPerWeek: 7 },
  { name: 'Tomar agua', emoji: '💧', targetPerWeek: 7 },
  { name: 'Dormir 7 h', emoji: '😴', targetPerWeek: 5 },
  { name: 'Estirar', emoji: '🤸', targetPerWeek: 4 },
  { name: 'Sin azúcar', emoji: '🍬', targetPerWeek: 5 },
  { name: 'Sin pantallas antes de dormir', emoji: '📵', targetPerWeek: 5 },
  { name: 'Caminar', emoji: '🚶', targetPerWeek: 5 },
  { name: 'Comer fruta', emoji: '🍎', targetPerWeek: 7 },
  { name: 'Escribir un diario', emoji: '✍️', targetPerWeek: 3 },
]

// Reactions offered on feed items.
export const REACTION_EMOJIS = ['🔥', '💪', '👏', '😍', '😂', '🎉']

// Exercise types
export const EXERCISE_TYPES = [
  'Correr',
  'Caminar',
  'Bicicleta',
  'Pesas',
  'Yoga',
  'Natación',
  'Fútbol',
  'CrossFit',
  'Baile',
  'Tenis',
  'Pádel',
  'Squash',
  'Boxeo',
  'Artes Marciales',
  'Escalada',
  'Remo',
  'Pilates',
  'Senderismo',
  'Basketball',
  'Volleyball',
  'Calistenia',
  'Funcional',
  'Spinning',
  'Elíptica',
  'Otro',
]

/**
 * Normalize a workout's exerciseType to always return an array.
 * Handles legacy string format and new array format.
 */
export function getExerciseTypes(workout) {
  if (!workout?.exerciseType) return []
  if (Array.isArray(workout.exerciseType)) return workout.exerciseType
  return [workout.exerciseType]
}

/** Format exercise types as a comma-separated string for display. */
export function formatExerciseTypes(workout) {
  return getExerciseTypes(workout).join(' + ')
}

/**
 * Compute "fit points" for a single workout based on duration tiers.
 * Designed to reward longer sessions without punishing short ones.
 *   <20 min        = 0.5 pts
 *   20–44 min      = 1 pt   (the baseline session)
 *   45–69 min      = 1.5 pts
 *   70–99 min      = 2 pts
 *   100+ min       = 2.5 pts (capped)
 */
export function getWorkoutPoints(workout) {
  const m = workout?.duration || 0
  if (m <= 0) return 0
  if (m < 20) return 0.5
  if (m < 45) return 1
  if (m < 70) return 1.5
  if (m < 100) return 2
  return 2.5
}

export function getTotalPoints(workouts) {
  return workouts.reduce((sum, w) => sum + getWorkoutPoints(w), 0)
}

// Format CLP (used by the read-only Archivo page of the fines season)
export const formatCLP = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

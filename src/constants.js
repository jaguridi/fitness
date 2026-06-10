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
 * Get the mood-appropriate avatar for a user based on their game state.
 * - happy: has shield OR streak >= 3
 * - sad: has fines AND streak is 0 AND consecutiveMisses > 0
 * - normal: everything else
 */
export function getAvatarForMood(userConst, userFirestore) {
  if (!userConst?.avatarMoods) return userConst?.avatar || '🏃'

  const streak = userFirestore?.consecutiveSuccesses || 0
  const hasShield = userFirestore?.hasShield || false
  const misses = userFirestore?.consecutiveMisses || 0
  const fines = userFirestore?.walletBalance || 0

  if (hasShield || streak >= 3) return userConst.avatarMoods.happy
  if (misses > 0 && fines > 0) return userConst.avatarMoods.sad
  return userConst.avatarMoods.normal
}

// Game rules live in src/game/constants.js (pure module shared with Cloud
// Functions); re-exported here so UI imports keep working unchanged.
export {
  WEEKLY_GOAL,
  BASE_FINE,
  MAX_FINE,
  EXTRA_LIFE_THRESHOLD,
  MAX_LIVES_PER_WEEK,
  EXTRAS_PER_FINE_REDEMPTION,
  FINE_REDEMPTION_AMOUNT,
} from './game/constants.js'

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

// Format CLP
export const formatCLP = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

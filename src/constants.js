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
  { id: 'user4', name: 'Fran', avatar: '🚴‍♀️' },
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

// Game rules
export const WEEKLY_GOAL = 3
export const BASE_FINE = 5000
export const MAX_FINE = 40000
export const EXTRA_LIFE_THRESHOLD = 5
export const MAX_LIVES_PER_WEEK = 1

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
  'Otro',
]

// Format CLP
export const formatCLP = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

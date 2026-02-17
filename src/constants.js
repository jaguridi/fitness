// The 4 family members
export const USERS = [
  { id: 'user1', name: 'Jose', avatar: '🏋️‍♂️' },
  { id: 'user2', name: 'Javi', avatar: '🧘‍♀️' },
  { id: 'user3', name: 'Gonza', avatar: '🏃‍♂️' },
  { id: 'user4', name: 'Fran', avatar: '🚴‍♀️' },
]

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

/**
 * Streak utilities — pure functions, no Firestore dependency.
 * All dates are interpreted as local-time YYYY-MM-DD strings.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function todayStr() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return formatYMD(d)
}

function formatYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYMD(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Current consecutive-day streak (counted in local time).
 * Counts back from today (or yesterday if today has no workout yet).
 */
export function getCurrentDayStreak(workouts) {
  const dates = new Set(workouts.map((w) => w.date).filter(Boolean))
  if (dates.size === 0) return 0

  const today = parseYMD(todayStr())
  // If there's no workout today, allow yesterday as the streak head so the
  // count doesn't visually "reset" at midnight before today's session.
  let cursor = new Date(today)
  if (!dates.has(formatYMD(cursor))) {
    cursor = new Date(cursor.getTime() - MS_PER_DAY)
  }

  let streak = 0
  while (dates.has(formatYMD(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - MS_PER_DAY)
  }
  return streak
}

/**
 * Longest consecutive-day streak across all workouts.
 */
export function getBestDayStreak(workouts) {
  const dates = [...new Set(workouts.map((w) => w.date).filter(Boolean))].sort()
  if (dates.length === 0) return 0

  let best = 1
  let cur = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = parseYMD(dates[i - 1])
    const curD = parseYMD(dates[i])
    const diff = Math.round((curD - prev) / MS_PER_DAY)
    if (diff === 1) {
      cur++
      best = Math.max(best, cur)
    } else if (diff > 1) {
      cur = 1
    }
  }
  return best
}

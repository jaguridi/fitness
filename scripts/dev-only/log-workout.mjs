// Logs workouts on a family member's behalf when they can't use the app
// (no photo; marked `loggedBy: 'admin'`). Only into weeks that haven't closed
// yet, so the normal week-end close counts them. Creating the doc fires the
// usual "💪 X entrenó" push to the rest of the family.
// Usage:
//   node scripts/dev-only/log-workout.mjs user2 --dates 2026-10-19,2026-10-20 \
//     --type Elíptica --duration 60 --description "Gimnasio" [--apply]
// --type accepts several comma-separated types. Dry-run by default. Uses the
// Firebase CLI login.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { USERS, EXERCISE_TYPES } from '../../src/constants.js'
import { getWeekId } from '../../src/game/weekId.js'

const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url))
const { Firestore, FieldValue } = requireFunctions('@google-cloud/firestore')
const { OAuth2Client } = requireFunctions('google-auth-library')
const cliRoot = process.env.FIREBASE_TOOLS_ROOT || join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'firebase-tools')
const requireCli = createRequire(join(cliRoot, 'package.json'))
const { getAccessToken } = requireCli('./lib/auth.js')
const { configstore } = requireCli('./lib/configstore.js')
const refreshToken = configstore.get('tokens')?.refresh_token
assert(refreshToken, 'Firebase CLI login is required.')
const token = await getAccessToken(refreshToken, [])
const authClient = new OAuth2Client()
authClient.setCredentials({ access_token: token.access_token,
  expiry_date: Date.now() + (token.expires_in || 3600) * 1000 })
const db = new Firestore({ projectId: 'family-fitness-3494e', authClient })

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const user = USERS.find((u) => u.id === args[0])
assert(user, `Usage: log-workout.mjs <${USERS.map((u) => u.id).join('|')}> --dates YYYY-MM-DD[,…] --type T[,…] --duration MIN [--description TEXT] [--apply]`)
const dates = (opt('dates') || '').split(',').filter(Boolean)
const types = (opt('type') || '').split(',').map((t) => t.trim()).filter(Boolean)
const duration = Number(opt('duration'))
const description = opt('description') || ''
assert(dates.length > 0, '--dates is required')
assert(types.length > 0 && types.every((t) => EXERCISE_TYPES.includes(t)), `--type must be among: ${EXERCISE_TYPES.join(', ')}`)
assert(Number.isInteger(duration) && duration > 0 && duration <= 300, '--duration must be 1–300 minutes')

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
const meta = (await db.doc('settings/meta').get()).data()
const existing = (await db.collection('workouts').where('userId', '==', user.id).get()).docs.map((d) => d.data())
const workouts = dates.map((date) => {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today, `${date}: not a valid past or current date`)
  const weekId = getWeekId(new Date(`${date}T12:00:00`))
  assert(weekId > meta.lastAutoProcessedWeekId, `${date} is in ${weekId}, already closed`)
  assert(!existing.some((w) => w.date === date), `${user.name} already has a workout on ${date}`)
  return { userId: user.id, date, weekId, exerciseType: types, duration, description, loggedBy: 'admin' }
})

if (process.argv.includes('--apply')) {
  for (const w of workouts) {
    const ref = await db.collection('workouts').add({ ...w, createdAt: FieldValue.serverTimestamp() })
    console.log(`logged ${ref.id}: ${user.name} ${w.date} (${w.weekId}) ${types.join(' + ')} ${duration} min`)
  }
} else {
  console.log(JSON.stringify({ status: 'dry-run', user: user.name, workouts }, null, 2))
}
await db.terminate()

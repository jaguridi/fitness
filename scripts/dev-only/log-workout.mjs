// Logs workouts on a family member's behalf when they can't use the app
// (marked `loggedBy: 'admin'`). v2: the photo is mandatory, like in the app —
// pass the photo they sent you (a local image, uploaded to Storage on --apply,
// or an existing https URL). Only into weeks the v2 close hasn't closed yet
// (settings/meta.v2LastClosedWeekId), so the normal weekly close counts them.
// Creating the doc fires the usual "💪 X entrenó" push to the rest of the family.
// Usage:
//   node scripts/dev-only/log-workout.mjs user2 --dates 2026-11-23,2026-11-24 \
//     --type Elíptica --duration 60 --photo ./foto.jpg [--description "Gimnasio"] [--apply]
// --type accepts several comma-separated types. --photo takes one photo for
// every date, or one per date (comma-separated, same order as --dates).
// Dry-run by default (nothing is uploaded or written). Uses the Firebase CLI login.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { USERS, EXERCISE_TYPES } from '../../src/constants.js'
import { getWeekId, getPreviousWeekId } from '../../src/game/weekId.js'
import { V2_START_WEEK } from '../../src/game/constants.js'

const PROJECT_ID = 'family-fitness-3494e'
const BUCKET = 'family-fitness-3494e.firebasestorage.app'

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
const db = new Firestore({ projectId: PROJECT_ID, authClient })

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean)
const user = USERS.find((u) => u.id === args[0])
assert(user, `Usage: log-workout.mjs <${USERS.map((u) => u.id).join('|')}> --dates YYYY-MM-DD[,…] --type T[,…] --duration MIN --photo FILE|URL[,…] [--description TEXT] [--apply]`)
const dates = list(opt('dates'))
const types = list(opt('type'))
const duration = Number(opt('duration'))
const description = opt('description') || ''
const photos = list(opt('photo'))
assert(dates.length > 0, '--dates is required')
assert(types.length > 0 && types.every((t) => EXERCISE_TYPES.includes(t)), `--type must be among: ${EXERCISE_TYPES.join(', ')}`)
assert(Number.isInteger(duration) && duration > 0 && duration <= 300, '--duration must be 1–300 minutes')
assert(photos.length === 1 || photos.length === dates.length, '--photo is required: one for all dates, or one per date')

const CONTENT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }
for (const p of photos) {
  if (/^https:\/\//.test(p)) continue
  assert(existsSync(p), `${p}: file not found`)
  assert(CONTENT_TYPES[extname(p).slice(1).toLowerCase()], `${p}: must be a jpg, png, webp or heic image`)
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
const meta = (await db.doc('settings/meta').get()).data() || {}
const lastClosed = meta.v2LastClosedWeekId || getPreviousWeekId(V2_START_WEEK)
const existing = (await db.collection('workouts').where('userId', '==', user.id).get()).docs.map((d) => d.data())
const workouts = dates.map((date, i) => {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today, `${date}: not a valid past or current date`)
  const weekId = getWeekId(new Date(`${date}T12:00:00`))
  assert(weekId > lastClosed, `${date} is in ${weekId}, already closed (v2 lock at ${lastClosed})`)
  assert(!existing.some((w) => w.date === date), `${user.name} already has a workout on ${date}`)
  return { userId: user.id, date, weekId, exerciseType: types, duration, description, loggedBy: 'admin',
    photo: photos.length === 1 ? photos[0] : photos[i] }
})

/** Upload a local photo like the app does (workouts/{userId}/{date}_{ms}.{ext}) and return a download URL. */
async function uploadPhoto(file, date) {
  if (/^https:\/\//.test(file)) return file
  const { Storage } = requireFunctions('@google-cloud/storage')
  const storage = new Storage({ projectId: PROJECT_ID, authClient })
  const ext = extname(file).slice(1).toLowerCase()
  const path = `workouts/${user.id}/${date}_${Date.now()}.${ext}`
  const downloadToken = randomUUID()
  await storage.bucket(BUCKET).upload(file, {
    destination: path,
    metadata: { contentType: CONTENT_TYPES[ext], metadata: { firebaseStorageDownloadTokens: downloadToken } },
  })
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`
}

if (process.argv.includes('--apply')) {
  const uploaded = new Map()
  for (const { photo, ...w } of workouts) {
    if (!uploaded.has(photo)) uploaded.set(photo, await uploadPhoto(photo, w.date))
    const photoURL = uploaded.get(photo)
    const ref = await db.collection('workouts').add({ ...w, photoURL, createdAt: FieldValue.serverTimestamp() })
    console.log(`logged ${ref.id}: ${user.name} ${w.date} (${w.weekId}) ${types.join(' + ')} ${duration} min`)
  }
} else {
  console.log(JSON.stringify({ status: 'dry-run', user: user.name, v2LastClosedWeekId: lastClosed, workouts }, null, 2))
}
await db.terminate()

// Clears a user's login PIN so the next login asks them to create a new one
// (AuthContext treats a user with no pin/pinHash as first-time). Use when a
// family member forgot their PIN. Never prints or stores the PIN itself.
// Usage: node scripts/dev-only/reset-pin.mjs user2 [--apply]
// Dry-run by default. Uses the Firebase CLI login.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { USER_IDS } from '../../src/game/constants.js'

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

const userId = process.argv[2]
assert(USER_IDS.includes(userId), `Usage: reset-pin.mjs <${USER_IDS.join('|')}> [--apply]`)
const ref = db.doc(`users/${userId}`)
const snap = await ref.get()
assert(snap.exists, `${userId} not found`)
const u = snap.data()
const has = { legacyPin: u.pin != null, pinHash: u.pinHash != null, pinSalt: u.pinSalt != null }
if (process.argv.includes('--apply')) {
  await ref.update({ pin: FieldValue.delete(), pinHash: FieldValue.delete(), pinSalt: FieldValue.delete(),
    pinResetAt: new Date().toISOString() })
  console.log(`${u.name}: PIN cleared (had ${JSON.stringify(has)}); next login creates a new one.`)
} else {
  console.log(`dry-run — ${u.name} has ${JSON.stringify(has)}; pass --apply to clear it.`)
}
await db.terminate()

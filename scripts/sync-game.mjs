// Copies the pure game-logic modules from src/game/ into functions/game/ so
// Cloud Functions run EXACTLY the same week-end math as the client.
//
// Runs automatically before `firebase deploy` (see firebase.json predeploy).
// Never edit functions/game/ by hand — changes belong in src/game/.

import { copyFileSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(root, 'src', 'game')
const outDir = join(root, 'functions', 'game')

mkdirSync(outDir, { recursive: true })

const BANNER = `// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.\n// Run \`node scripts/sync-game.mjs\` after changing the source module.\n\n`

const files = readdirSync(srcDir).filter((f) => f.endsWith('.js'))
for (const f of files) {
  const content = readFileSync(join(srcDir, f), 'utf8')
  writeFileSync(join(outDir, f), BANNER + content)
  console.log(`synced ${f}`)
}

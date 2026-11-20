// Copies the pure game-logic modules from src/game/ into functions/game/ so
// Cloud Functions run EXACTLY the same week-close math as the client.
//
// Runs automatically before `firebase deploy` (see firebase.json predeploy).
// Never edit functions/game/ by hand — changes belong in src/game/.
// functions/game/ always mirrors src/game/*.js exactly: files that no longer
// exist in src/game/ are deleted (tests in src/game/__tests__ are not copied).

import { mkdirSync, readdirSync, writeFileSync, readFileSync, unlinkSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(root, 'src', 'game')
const outDir = join(root, 'functions', 'game')

mkdirSync(outDir, { recursive: true })

const BANNER = `// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.\n// Run \`node scripts/sync-game.mjs\` after changing the source module.\n\n`

const isJsFile = (dir, f) => f.endsWith('.js') && statSync(join(dir, f)).isFile()

const files = readdirSync(srcDir).filter((f) => isJsFile(srcDir, f))
for (const f of files) {
  const content = readFileSync(join(srcDir, f), 'utf8')
  writeFileSync(join(outDir, f), BANNER + content)
  console.log(`synced ${f}`)
}

const keep = new Set(files)
for (const f of readdirSync(outDir)) {
  if (!keep.has(f) && statSync(join(outDir, f)).isFile()) {
    unlinkSync(join(outDir, f))
    console.log(`removed stale ${f}`)
  }
}

// Shrinks the mood avatars in public/avatars/ — the AI-generated originals
// weigh 7-8 MB each (~45 MB total shipped to every phone). Resizes to fit
// 512×512 (they render at ≤100 px) and palette-compresses, keeping alpha.
// The full-resolution originals at the repo root stay untouched as masters.
//
// Run after replacing any avatar: node scripts/optimize-avatars.mjs

import sharp from 'sharp'
import { readdirSync, statSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dir = join(root, 'public', 'avatars')

const MAX_DIM = 512

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
  const path = join(dir, file)
  const before = statSync(path).size
  if (before < 400 * 1024) {
    console.log(`${file}: ${(before / 1024).toFixed(0)} KB — already small, skipped`)
    continue
  }
  const tmp = `${path}.tmp`
  await sharp(path)
    .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(tmp)
  renameSync(tmp, path)
  const after = statSync(path).size
  console.log(`${file}: ${(before / 1024 / 1024).toFixed(1)} MB → ${(after / 1024).toFixed(0)} KB`)
}

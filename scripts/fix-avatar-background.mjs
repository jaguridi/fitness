// The mood avatars were exported with a fake "transparency" checkerboard baked
// into the pixels (no alpha channel). This removes it: neutral grey/white pixels
// reachable from the image border become transparent, and so do enclosed pockets
// that are clearly checkerboard (a mix of the two checker tones), e.g. the gap
// between an arm and the body. The dark pixel-art outline stops the flood.
//
// Usage: node scripts/fix-avatar-background.mjs [outDir]   (default: in place)
import sharp from 'sharp'
import { readdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dir = join(root, 'public', 'avatars')
const outDir = process.argv[2] || dir

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
  const { data, info } = await sharp(join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const N = W * H

  // Checkerboard tones are near-neutral. Each file has its own pair of tones
  // (Jose: ~152/~219, Fran: ~225/~253), so estimate them from the image border
  // and only treat pixels inside that tone range as background — otherwise a
  // pure-white shirt next to a ~219 checker would be eaten too.
  const lum = new Uint8Array(N)
  const sat = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    lum[i] = (r + g + b) / 3
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b)
  }
  const borderLum = []
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) borderLum.push(lum[y * W + x])
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) borderLum.push(lum[y * W + x])
  borderLum.sort((a, b) => a - b)
  const toneLow = borderLum[Math.floor(borderLum.length * 0.15)]
  const toneHigh = borderLum[Math.floor(borderLum.length * 0.85)]
  const lo = toneLow - 14
  const hi = Math.min(255, toneHigh + 14)
  const mid = (toneLow + toneHigh) / 2
  const neutral = new Uint8Array(N)
  for (let i = 0; i < N; i++) neutral[i] = sat[i] <= 22 && lum[i] >= lo && lum[i] <= hi ? 1 : 0

  // Label connected components of neutral pixels (4-connectivity).
  const label = new Int32Array(N).fill(-1)
  const comps = []
  const stack = []
  for (let start = 0; start < N; start++) {
    if (!neutral[start] || label[start] !== -1) continue
    const id = comps.length
    const c = { size: 0, light: 0, grey: 0, border: false }
    stack.push(start)
    label[start] = id
    while (stack.length) {
      const p = stack.pop()
      const x = p % W, y = (p / W) | 0
      c.size++
      if (lum[p] >= mid + 8) c.light++
      else if (lum[p] <= mid - 8) c.grey++
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c.border = true
      if (x > 0 && neutral[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack.push(p - 1) }
      if (x < W - 1 && neutral[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack.push(p + 1) }
      if (y > 0 && neutral[p - W] && label[p - W] === -1) { label[p - W] = id; stack.push(p - W) }
      if (y < H - 1 && neutral[p + W] && label[p + W] === -1) { label[p + W] = id; stack.push(p + W) }
    }
    comps.push(c)
  }

  const remove = comps.map((c) => {
    if (c.border) return true
    // Enclosed pocket: only if it really is a two-tone checker, not flat clothing.
    const lightShare = c.light / c.size
    const greyShare = c.grey / c.size
    return c.size >= 60 && lightShare >= 0.25 && greyShare >= 0.25
  })

  let cleared = 0
  for (let i = 0; i < N; i++) {
    if (label[i] !== -1 && remove[label[i]]) { data[i * 4 + 3] = 0; cleared++ }
  }

  // Sweep leftover specks: tiny opaque islands (compression noise, the
  // generator's watermark sparkle) that are not part of the character.
  const seen = new Uint8Array(N)
  for (let start = 0; start < N; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue
    const island = [start]
    seen[start] = 1
    for (let k = 0; k < island.length; k++) {
      const p = island[k]
      const x = p % W, y = (p / W) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const q = ny * W + nx
          if (!seen[q] && data[q * 4 + 3] !== 0) { seen[q] = 1; island.push(q) }
        }
      }
    }
    if (island.length < 220) {
      for (const p of island) data[p * 4 + 3] = 0
      cleared += island.length
    }
  }

  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, file) + (outDir === dir ? '.tmp' : ''))
  if (outDir === dir) renameSync(join(dir, file + '.tmp'), join(dir, file))
  console.log(`${file}: tones ${toneLow}/${toneHigh}, cleared ${((100 * cleared) / N).toFixed(1)}%`)
}

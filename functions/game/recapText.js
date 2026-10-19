// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Grammatical-gender cues for the AI writers (weekly/monthly recaps, judge).
// IMPORTANT: like the rest of src/game/, no imports — Cloud Functions run it
// unchanged via scripts/sync-game.mjs.
//
// W42 lesson: the prompt said "Jose (hombre): 0/3 sesiones…" and the model
// copied "Jose (hombre)" straight into the family-facing recap. So the gender
// now travels in its own block, away from the data lines, and anything the
// model still writes as "Name (mujer)" is stripped before saving.

const GRAMMATICAL = { m: 'masculino', f: 'femenino' }

/**
 * Prompt block telling the model each person's grammatical gender without
 * gluing it to the name. people: [{ name, gender: 'm' | 'f' }].
 */
export function genderGuide(people) {
  const lines = people
    .filter((p) => p?.name && GRAMMATICAL[p.gender])
    .map((p) => `- ${p.name}: ${GRAMMATICAL[p.gender]}`)
  if (lines.length === 0) return ''
  return `Género gramatical (solo para conjugar bien; NO lo escribas en el texto):\n${lines.join('\n')}`
}

const GENDER_WORD = '(?:hombres?|mujer(?:es)?|masculin[oa]s?|femenin[oa]s?)'
// "(hombre)", "( Mujer )", "(género: mujer)", " — género: hombre"… but never a
// bare word, so prose like "Jose, hombre de pocas palabras" survives.
const TAG = `(?:\\s*\\(\\s*(?:g[eé]nero\\s*:?\\s*)?${GENDER_WORD}\\s*\\)` +
  `|\\s*[—–,:-]\\s*g[eé]nero\\s*:?\\s*${GENDER_WORD}(?!\\p{L}))`

const VOWEL = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]' }

// Accent-insensitive regex source for a name: "Jose" also matches "José".
function namePattern(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[aeiou]/gi, (v) => VOWEL[v.toLowerCase()])
}

/**
 * Removes a gender tag written right after a known name, keeping the name as
 * the model wrote it: "Fran (mujer) también…" → "Fran también…".
 */
export function stripGenderTags(text, names) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (const name of new Set((names || []).filter(Boolean))) {
    const re = new RegExp(`(?<!\\p{L})(${namePattern(name)})${TAG}`, 'giu')
    out = out.replace(re, '$1')
  }
  return out
}

/**
 * AI Judge Service — Calls Firebase Cloud Function that uses GPT-5.6 Luna
 * (OpenAI) to evaluate exercise excuses.
 *
 * The AI evaluates whether an excuse for missing the weekly goal is valid.
 * Only UNFORESEEN situations qualify (illness, injury, emergency).
 * Foreseeable absences should use the "Planned Absence" feature instead.
 *
 * When the AI fails for any reason, returns aiError: true so the caller
 * can route the justification to family voting instead of rejecting.
 */

import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '../firebase'

const functions = getFunctions(app)
const evaluateJustificationFn = httpsCallable(functions, 'evaluateJustification')

/**
 * Evaluate an excuse using the Cloud Function (GPT-5.6 Luna).
 *
 * `context` lets the judge see the week as the game sees it — above all whether
 * a PARTIAL freeze is already in place, so a trip that was frozen through
 * Tuesday isn't rejected as "you should have frozen the whole week". The
 * function re-reads the real numbers from Firestore; only the ids travel.
 *
 * @param {string} excuse - The user's excuse text
 * @param {string|null} photoBase64 - Optional photo evidence as base64 data URL
 * @param {{userId?: string, weekId?: string, sessionsJustified?: number}} [context]
 * @returns {Promise<{valid: boolean, reason: string, aiError?: boolean}>}
 */
export async function evaluateExcuse(excuse, photoBase64 = null, context = {}) {
  try {
    const { data } = await evaluateJustificationFn({
      excuse: excuse.trim(),
      photoBase64: photoBase64 && photoBase64.startsWith('data:') ? photoBase64 : null,
      userId: context.userId || null,
      weekId: context.weekId || null,
      sessionsJustified: context.sessionsJustified ?? null,
    })

    return {
      valid: Boolean(data.valid),
      reason: data.reason || 'Sin explicación.',
      ...(data.aiError ? { aiError: true } : {}),
    }
  } catch (err) {
    console.error('AI Judge error:', err)
    return {
      valid: false,
      reason: 'Error al conectar con el Juez IA. Tu justificación será votada por la familia.',
      aiError: true,
    }
  }
}

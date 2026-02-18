/**
 * AI Judge Service — Uses Google Gemini Flash to evaluate exercise excuses.
 *
 * The AI evaluates whether an excuse for missing the weekly goal is valid.
 * Only UNFORESEEN situations qualify (illness, injury, emergency).
 * Foreseeable absences should use the "Planned Absence" feature instead.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const SYSTEM_PROMPT = `Eres el juez estricto pero justo del reto fitness familiar "FitFamily".

CONTEXTO:
- 4 miembros de una familia deben completar 3 sesiones de ejercicio por semana
- Si no cumplen, pagan una multa en pesos chilenos
- Existe un sistema de "semana congelada" para ausencias PREVISIBLES (viajes, vacaciones, etc.)
- Las justificaciones son SOLO para IMPREVISTOS (cosas que no se pudieron planificar)

CRITERIOS PARA ACEPTAR:
- Enfermedad súbita (gripe, COVID, infección) — idealmente con certificado médico o foto
- Lesión que impida ejercicio — con evidencia (foto, certificado)
- Emergencia familiar grave (hospitalización de familiar, accidente)
- Catástrofe natural o situación de fuerza mayor

CRITERIOS PARA RECHAZAR:
- "No tuve tiempo" / "Estuve ocupado" — siempre hay 30 min para ejercicio
- Flojera, cansancio, falta de motivación — eso es precisamente lo que el reto combate
- Viaje planificado — eso se congela con anticipación
- Clima — se puede ejercitar adentro
- Excusas vagas sin evidencia concreta
- Trabajo excesivo — se puede hacer ejercicio corto
- Cualquier situación que ERA previsible y se pudo planificar como semana congelada

SÉ ESTRICTO. El objetivo del reto es que NO haya excusas fáciles. Solo situaciones genuinamente fuera del control de la persona.

Si el usuario menciona evidencia (certificado, foto) pero no la adjunta, pídela.
Si adjunta una imagen, evalúala como evidencia.`

/**
 * Evaluate an excuse using Gemini AI.
 *
 * @param {string} excuse - The user's excuse text
 * @param {string|null} photoBase64 - Optional photo evidence as base64 data URL
 * @returns {Promise<{valid: boolean, reason: string}>}
 */
export async function evaluateExcuse(excuse, photoBase64 = null) {
  if (!GEMINI_API_KEY) {
    return {
      valid: false,
      reason: 'Sistema de IA no configurado. Configura VITE_GEMINI_API_KEY en .env.',
    }
  }

  try {
    const parts = [
      { text: SYSTEM_PROMPT },
      { text: `\nJUSTIFICACIÓN DEL USUARIO:\n"${excuse}"\n\nResponde SOLO con un JSON válido (sin markdown, sin backticks):\n{"valid": true/false, "reason": "explicación breve en español de máximo 2 frases"}` },
    ]

    // If photo evidence is provided, include it
    if (photoBase64) {
      const base64Data = photoBase64.split(',')[1] || photoBase64
      const mimeType = photoBase64.match(/data:(.*?);/)?.[1] || 'image/jpeg'
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      })
      parts[1].text += '\n\n(El usuario adjuntó una imagen como evidencia. Evalúala.)'
    }

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent judgments
          maxOutputTokens: 200,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      throw new Error('Error al consultar la IA')
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Could not parse AI response:', text)
      return { valid: false, reason: 'No se pudo interpretar la respuesta de la IA.' }
    }

    const result = JSON.parse(jsonMatch[0])
    return {
      valid: Boolean(result.valid),
      reason: result.reason || 'Sin explicación.',
    }
  } catch (err) {
    console.error('AI Judge error:', err)
    return {
      valid: false,
      reason: 'Error al evaluar la justificación. Inténtalo de nuevo.',
    }
  }
}

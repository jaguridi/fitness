// One-off family agreements. A holiday creates no recovery debt, preserves
// streaks/lives/shields/fine levels, and makes every workout an extra.
// Keep this dated: it must not silently grant future holidays.
// emoji/title label the week in history, the recap card and the close push.
export const HOLIDAY_WEEKS = {
  '2026-W38': {
    name: 'Fiestas Patrias',
    emoji: '🇨🇱',
    title: '🇨🇱 ¡Felices Fiestas Patrias!',
    recap: '¡Felices Fiestas Patrias, familia! 🇨🇱 Ojalá hayan disfrutado las empanadas, los asados y el descanso bien merecido. Tal como acordamos entre todos, la semana del 14 al 20 de septiembre fue libre: sin multas ni nuevas sesiones por recuperar. ¡Felicitaciones a José, Javi y Gonza por sumar una sesión extra cada uno, que cuenta para sus recuperaciones pendientes! 💪 Esta semana retomamos el ritmo con buena energía. ¡Viva Chile! 🎉',
    revision: 'fiestas-patrias-2026',
  },
  // Agreed by the family during the week itself, applied after its close
  // (scripts/dev-only/apply-w41-perdonazo-2026.mjs).
  '2026-W41': {
    name: 'Perdonazo masivo',
    emoji: '🕊️',
    title: '🕊️ ¡Perdonazo masivo!',
    recap: '¡Perdonazo masivo, familia! 🕊️ La semana del 5 al 11 de octubre costó para todos, así que acordamos dejarla libre: sin multas, sin tocar rachas ni niveles de multa, y sin nuevas sesiones por recuperar. Lo que alguien entrenara contaba como extra, pero esta vez nadie alcanzó a registrar sesiones, así que simplemente quedó todo perdonado. 🙌 De yapa, los dos congelamientos antiguos de Jose que vencían justo esa semana también quedaron perdonados. Javi, seguimos mandándote mucho ánimo desde acá. 🌱 Ahora sí: esta semana volvemos a movernos en familia. 💪',
    revision: 'perdonazo-w41-2026',
  },
  // Agreed after its close too (scripts/dev-only/apply-w42-perdonazo-2026.mjs),
  // together with Javi's return and the forgiveness of her old freezes.
  '2026-W42': {
    name: 'Perdonazo masivo',
    emoji: '🕊️',
    title: '🕊️ ¡Otro perdonazo masivo!',
    recap: '¡Otro perdonazo masivo, familia! 🕊️ La semana del 12 al 18 de octubre tampoco fue fácil, así que acordamos dejarla libre: sin multas, sin tocar rachas ni niveles de multa, y sin nuevas sesiones por recuperar. Nadie alcanzó a registrar sesiones, así que quedó todo perdonado. 🙌 Y la mejor noticia: ¡Javi vuelve al juego esta semana! 🌱 Para que parta limpia, sus dos congelamientos antiguos (4 sesiones pendientes) también quedaron perdonados. Ahora sí, los cuatro de vuelta: a moverse en familia. 💪',
    revision: 'perdonazo-w42-2026',
  },
}

export const getHoliday = (weekId) => HOLIDAY_WEEKS[weekId] || null

// Per-user compensation weeks: for the listed users the week requires nothing,
// so EVERY session they logged is an extra (pays recovery debt, then goes to
// the bank). The week still counts as met — streak, fine level and lives
// follow the normal completed-week rules. Other users are unaffected.
export const BONUS_WEEKS = {
  '2026-W39': {
    userIds: ['user3', 'user4'],
    name: 'Compensación semana 39',
    recap: 'La semana 39 fue especial. 💙 Javi está pasando por un periodo difícil de salud, así que su semana quedó justificada, igual que la de Jose, que la acompañó al doctor: sin multas para ninguno. Desde esta semana Javi queda en pausa hasta que se recupere. ¡Mucho ánimo, Javi, te esperamos de vuelta! 🌱 Para compensar, todas las sesiones de Gonza (3) y de Fran (2) cuentan como extras: con ellas ambos terminaron de pagar su congelamiento de la semana 37 y a Gonza le sobró un extra para el banco. 💪 Gracias por la paciencia y a seguir moviéndose en familia.',
    revision: 'w39-compensacion-2026',
  },
}

export const getBonusWeek = (userId, weekId) =>
  (BONUS_WEEKS[weekId]?.userIds.includes(userId) ? BONUS_WEEKS[weekId] : null)

// Family-approved copy that replaces the AI recap for that week.
export const getAgreedRecap = (weekId) => HOLIDAY_WEEKS[weekId] || BONUS_WEEKS[weekId] || null

// Participation pauses: the user is out of the game — no requirement, no fine,
// no new recovery debt, and every stat (streak, shield, lives, fine level,
// bank) stays exactly as it was. Paused weeks never count toward the recovery
// deadline of the user's existing freezes, so their clock stops.
// untilWeekId: null = until further notice. To end a pause, set untilWeekId to
// the LAST paused week (never delete the entry: past closes depend on it) and
// deploy BOTH the functions and the client.
export const PARTICIPATION_PAUSES = [
  {
    userId: 'user2',
    fromWeekId: '2026-W40',
    // Back from W43 (agreed 2026-10-19); her two old freezes were forgiven
    // instead of falling due in her first week back.
    untilWeekId: '2026-W42',
    reason: 'Pausa médica por migraña crónica, hasta nuevo aviso del doctor.',
  },
]

const inPause = (p, weekId) => weekId >= p.fromWeekId && (p.untilWeekId == null || weekId <= p.untilWeekId)

export const getPause = (userId, weekId) =>
  PARTICIPATION_PAUSES.find((p) => p.userId === userId && inPause(p, weekId)) || null

export const getUserPauses = (userId) => PARTICIPATION_PAUSES.filter((p) => p.userId === userId)

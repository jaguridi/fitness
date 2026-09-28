// One-off family agreements. A holiday creates no recovery debt, preserves
// streaks/lives/shields/fine levels, and makes every workout an extra.
// Keep this dated: it must not silently grant future holidays.
export const HOLIDAY_WEEKS = {
  '2026-W38': {
    name: 'Fiestas Patrias',
    recap: '¡Felices Fiestas Patrias, familia! 🇨🇱 Ojalá hayan disfrutado las empanadas, los asados y el descanso bien merecido. Tal como acordamos entre todos, la semana del 14 al 20 de septiembre fue libre: sin multas ni nuevas sesiones por recuperar. ¡Felicitaciones a José, Javi y Gonza por sumar una sesión extra cada uno, que cuenta para sus recuperaciones pendientes! 💪 Esta semana retomamos el ritmo con buena energía. ¡Viva Chile! 🎉',
    revision: 'fiestas-patrias-2026',
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
    untilWeekId: null,
    reason: 'Pausa médica por migraña crónica, hasta nuevo aviso del doctor.',
  },
]

const inPause = (p, weekId) => weekId >= p.fromWeekId && (p.untilWeekId == null || weekId <= p.untilWeekId)

export const getPause = (userId, weekId) =>
  PARTICIPATION_PAUSES.find((p) => p.userId === userId && inPause(p, weekId)) || null

export const getUserPauses = (userId) => PARTICIPATION_PAUSES.filter((p) => p.userId === userId)

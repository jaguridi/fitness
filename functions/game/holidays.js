// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

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

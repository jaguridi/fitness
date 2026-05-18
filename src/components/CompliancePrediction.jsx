/**
 * Compliance prediction — heuristic projection for the current user's week.
 *
 * Logic:
 *   - Mon/Tue: don't show anything (too early; pure noise)
 *   - Wed onwards: project pace based on (days elapsed / 7) and warn if
 *     the projected end-of-week sessions falls short of the requirement
 *   - Suppress if goalMet or week is fully frozen
 *
 * Tone is intentionally light — this is a nudge, not a sermon.
 */

export default function CompliancePrediction({ status }) {
  if (!status) return null
  const { sessions, totalRequired, frozen, goalMet, user } = status
  if (frozen || goalMet || totalRequired === 0) return null

  // Day of week, Monday = 1, Sunday = 7
  const dow = new Date().getDay() || 7
  if (dow < 3) return null // wait until Wednesday

  const daysElapsed = dow // Monday=1 means 1 day used
  const daysRemaining = 7 - daysElapsed
  const remaining = Math.max(0, totalRequired - sessions)

  // Best-case feasibility: 1 session per remaining day max
  const feasible = remaining <= daysRemaining + 1 // +1 because today still counts

  // Pace projection: extrapolate current rate to end of week
  const pace = sessions / daysElapsed
  const projected = Math.round(pace * 7)

  // Critical: it's mathematically impossible to hit the goal
  if (!feasible) {
    return (
      <div className="bg-red-900/20 border border-red-700/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-semibold text-red-300 text-sm">
              Difícil cumplir esta semana
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">
              Te faltan {remaining} sesión(es) y quedan {daysRemaining} día(s).
              Considera enviar una justificación si tienes motivo válido.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Warning: projected to miss
  if (projected < totalRequired) {
    return (
      <div className="bg-amber-900/15 border border-amber-700/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📉</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-300 text-sm">
              A este ritmo, no llegas{user?.name ? `, ${user.name}` : ''}
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Llevas {sessions}/{totalRequired}. Proyección al domingo: {projected} sesión(es).
              {daysRemaining > 0 && ` Quedan ${daysRemaining} día(s).`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // On pace but threshold is close (within 1 session): gentle nudge on Sat/Sun
  if (dow >= 6 && remaining > 0) {
    return (
      <div className="bg-indigo-900/15 border border-indigo-700/30 rounded-2xl p-3">
        <p className="text-xs text-indigo-300 text-center">
          ⏰ Te falta{remaining > 1 ? 'n' : ''} {remaining} sesión(es) y estás justo en la línea.
        </p>
      </div>
    )
  }

  return null
}

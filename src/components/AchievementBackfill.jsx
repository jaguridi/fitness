import { useState } from 'react'
import { USERS } from '../constants'
import { ACHIEVEMENTS, checkAchievements } from '../services/achievements'
import {
  getUser,
  getUserSummaries,
  getWorkoutsByUser,
} from '../services/firebaseService'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

/**
 * One-time migration: pre-seed achievement_unlocks for all existing earned
 * achievements with a backdated createdAt timestamp. After running this,
 * users won't see a flood of "old" achievement posts in the feed when they
 * first log in post-deploy.
 *
 * Backdate strategy: use a fixed past date (2020-01-01) so seeded entries
 * sort to the very bottom of the feed's recency-ordered query and get
 * cropped out of the top-30 unless there's no other activity.
 *
 * Idempotent: doc IDs are deterministic (`{userId}_{achievementId}`), so
 * running this multiple times is safe — existing docs are skipped.
 */
export default function AchievementBackfill() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [confirm, setConfirm] = useState(false)

  const SEED_DATE = new Date('2020-01-01T00:00:00Z')

  const run = async () => {
    setRunning(true)
    setResult(null)
    const stats = { scanned: 0, seeded: 0, skipped: 0, errors: 0, perUser: {} }

    for (const u of USERS) {
      stats.perUser[u.name] = { seeded: 0, skipped: 0 }
      try {
        const [user, summaries, workouts] = await Promise.all([
          getUser(u.id),
          getUserSummaries(u.id),
          getWorkoutsByUser(u.id),
        ])
        const results = checkAchievements({
          summaries,
          workouts,
          user: user || {},
        })

        for (const a of results) {
          if (!a.earned) continue
          stats.scanned++

          const docId = `${u.id}_${a.id}`
          const ref = doc(db, 'achievement_unlocks', docId)
          const existing = await getDoc(ref)

          if (existing.exists()) {
            stats.skipped++
            stats.perUser[u.name].skipped++
            continue
          }

          await setDoc(ref, {
            userId: u.id,
            achievementId: a.id,
            name: a.name,
            description: a.description,
            icon: a.icon,
            seeded: true, // marker so we can tell these apart in the future
            createdAt: SEED_DATE,
          })
          stats.seeded++
          stats.perUser[u.name].seeded++

          // Also mark the localStorage flag for the currently visible user
          // so AchievementBadges doesn't immediately try to write again
          localStorage.setItem(`ach_seen_${u.id}_${a.id}`, '1')
        }
      } catch (err) {
        console.error(`Backfill error for ${u.name}:`, err)
        stats.errors++
      }
    }

    setResult(stats)
    setRunning(false)
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="font-bold text-white text-sm">🌱 Pre-cargar logros existentes</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Migración única: evita que el feed se inunde con logros viejos
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="bg-amber-900/15 border border-amber-700/30 rounded-xl p-3 text-xs text-amber-300">
          <p className="font-semibold mb-1">⚠️ Ejecuta esto UNA sola vez</p>
          <p className="text-amber-300/80">
            Recorre los 4 usuarios, detecta sus logros ya ganados y los registra
            con fecha 2020-01-01 (fuera del feed reciente). Idempotente: si lo
            corres dos veces, no duplica.
          </p>
        </div>

        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            disabled={running}
            className="w-full py-3 rounded-xl font-bold bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 transition-all active:scale-95"
          >
            🌱 Ejecutar pre-carga
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm(false)}
              disabled={running}
              className="flex-1 py-3 rounded-xl font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={run}
              disabled={running}
              className="flex-1 py-3 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {running ? '⏳ Corriendo...' : 'Confirmar y ejecutar'}
            </button>
          </div>
        )}

        {result && (
          <div className="bg-gray-900/50 rounded-xl p-3 text-xs space-y-1">
            <p className="text-green-400 font-semibold">
              ✓ Listo: {result.seeded} sembrados, {result.skipped} ya existían
              {result.errors > 0 && `, ${result.errors} errores`}
            </p>
            <p className="text-gray-500">
              Total escaneados: {result.scanned} de {ACHIEVEMENTS.length * USERS.length} posibles
            </p>
            <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-0.5">
              {Object.entries(result.perUser).map(([name, s]) => (
                <p key={name} className="text-gray-400">
                  <span className="font-semibold text-white">{name}</span>:{' '}
                  +{s.seeded} sembrados
                  {s.skipped > 0 && `, ${s.skipped} omitidos`}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

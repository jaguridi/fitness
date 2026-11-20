/**
 * Lógica pura del AchievementWatcher: decide qué registrar, qué sembrar en
 * silencio y qué celebrar, sin disparar dos veces (re-renders, StrictMode,
 * remontajes) y sin reintentar para siempre si una escritura falla.
 *
 *   const tracker = createUnlockTracker()
 *   const step = tracker.plan({ userId, needsSeed, pending, now })
 *   // step.seed: string[] | null   → actions.seedUnlocks(step.seed), luego tracker.seedDone/seedFailed
 *   // step.record: string[]        → actions.recordUnlock(id), luego tracker.recordDone/recordFailed
 *   // step.celebrate: string[]     → encolar la celebración (una sola vez por lámina)
 *   tracker.nextRetryIn(now)        // ms hasta el próximo reintento pendiente, o null
 */

/** Esperas antes de cada reintento; después del último, se rinde por esta sesión. */
export const RETRY_DELAYS = [4000, 15000, 60000, 180000]

/** ms a esperar tras `failures` fallos seguidos, o null si ya no hay que reintentar. */
export function retryDelay(failures) {
  if (failures < 1) return 0
  return failures <= RETRY_DELAYS.length ? RETRY_DELAYS[failures - 1] : null
}

export function createUnlockTracker() {
  /** key `${userId}:${id}` → { status: 'inflight'|'done'|'failed'|'gaveup'|'seeded', failures, retryAt } */
  const records = new Map()
  /** userId → { status, failures, retryAt } */
  const seeds = new Map()
  const celebrated = new Set()

  const due = (entry, now) => entry.status === 'failed' && now >= entry.retryAt

  function fail(entry, now) {
    entry.failures += 1
    const wait = retryDelay(entry.failures)
    if (wait == null) {
      entry.status = 'gaveup'
      entry.retryAt = Infinity
    } else {
      entry.status = 'failed'
      entry.retryAt = now + wait
    }
  }

  return {
    /**
     * @param {{ userId: string, needsSeed: boolean, pending: {id:string}[], now?: number }} input
     * @returns {{ seed: string[]|null, record: string[], celebrate: string[] }}
     */
    plan({ userId, needsSeed, pending, now = Date.now() }) {
      const out = { seed: null, record: [], celebrate: [] }
      if (!userId) return out
      const ids = (pending || []).map((a) => a.id)

      if (needsSeed) {
        const s = seeds.get(userId)
        // Lo ganado por historial nunca se celebra ni se registra como nuevo.
        for (const id of ids) {
          const key = `${userId}:${id}`
          if (!records.has(key)) records.set(key, { status: 'seeded', failures: 0, retryAt: 0 })
        }
        if (!s || due(s, now)) {
          seeds.set(userId, { status: 'inflight', failures: s?.failures || 0, retryAt: 0 })
          out.seed = ids
        }
        return out
      }

      for (const id of ids) {
        const key = `${userId}:${id}`
        const entry = records.get(key)
        if (!entry) {
          records.set(key, { status: 'inflight', failures: 0, retryAt: 0 })
          out.record.push(id)
          if (!celebrated.has(key)) {
            celebrated.add(key)
            out.celebrate.push(id)
          }
        } else if (due(entry, now)) {
          entry.status = 'inflight'
          out.record.push(id)
        }
        // inflight / done / gaveup / seeded: nada que hacer
      }
      return out
    },

    seedDone(userId) {
      seeds.set(userId, { status: 'done', failures: 0, retryAt: 0 })
    },
    seedFailed(userId, now = Date.now()) {
      const s = seeds.get(userId) || { status: 'inflight', failures: 0, retryAt: 0 }
      fail(s, now)
      seeds.set(userId, s)
    },
    recordDone(userId, id) {
      const key = `${userId}:${id}`
      records.set(key, { status: 'done', failures: 0, retryAt: 0 })
    },
    recordFailed(userId, id, now = Date.now()) {
      const key = `${userId}:${id}`
      const entry = records.get(key) || { status: 'inflight', failures: 0, retryAt: 0 }
      fail(entry, now)
      records.set(key, entry)
    },

    /** ms hasta el reintento más próximo (o null si no hay ninguno pendiente). */
    nextRetryIn(now = Date.now()) {
      let next = Infinity
      for (const e of [...records.values(), ...seeds.values()]) {
        if (e.status === 'failed') next = Math.min(next, e.retryAt)
      }
      return next === Infinity ? null : Math.max(0, next - now)
    },
  }
}

/** Cola de celebraciones: agrega sin repetir ids. */
export function enqueue(queue, ids) {
  const seen = new Set(queue)
  const add = ids.filter((id) => !seen.has(id) && (seen.add(id), true))
  return add.length ? [...queue, ...add] : queue
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useFamily, useUnlockPlan } from '../../data/FamilyDataProvider'
import { RARITIES, getAchievementDef } from '../../domain/achievements.js'
import { createUnlockTracker, enqueue } from './unlockTracker'
import StickCelebration from './StickCelebration'

// Una sola instancia por pestaña: sobrevive a remontajes (StrictMode, pantalla de
// carga) para no registrar ni celebrar dos veces la misma lámina.
const tracker = createUnlockTracker()

/** Pausa antes de mostrar la celebración (deja cerrar la hoja de registro); si hay
 *  otra capa abierta, espera a que se cierre. */
const SHOW_DELAY = 650

/**
 * Vigila las láminas recién ganadas por la persona que usa la app:
 * - la primera vez en la v2, registra en silencio todo lo ganado por historial;
 * - después, registra cada lámina nueva (sale en el feed) y la celebra.
 * Nunca celebra láminas sembradas ni de otros miembros.
 */
export default function AchievementWatcher() {
  const { currentUser } = useAuth()
  const userId = currentUser?.id
  const { ready, actions } = useFamily()
  const plan = useUnlockPlan(userId)
  const navigate = useNavigate()

  const [queue, setQueue] = useState([]) // [{ userId, id }]
  const [shown, setShown] = useState(0) // cuántas de esta tanda ya pasaron
  const [visible, setVisible] = useState(false)
  const [tick, setTick] = useState(0)
  const retryTimer = useRef(null)

  const scheduleRetry = useCallback(() => {
    const wait = tracker.nextRetryIn()
    if (wait == null) return
    clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(() => setTick((t) => t + 1), wait + 50)
  }, [])

  useEffect(() => () => clearTimeout(retryTimer.current), [])

  useEffect(() => {
    if (!ready || !userId || !actions) return
    const step = tracker.plan({ userId, needsSeed: plan.needsSeed, pending: plan.pending })

    if (step.seed) {
      Promise.resolve()
        .then(() => actions.seedUnlocks(step.seed))
        .then(
          () => tracker.seedDone(userId),
          (err) => {
            console.error('seedUnlocks failed:', err)
            tracker.seedFailed(userId)
            scheduleRetry()
          }
        )
    }
    for (const id of step.record) {
      Promise.resolve()
        .then(() => actions.recordUnlock(id))
        .then(
          () => tracker.recordDone(userId, id),
          (err) => {
            console.error(`recordUnlock ${id} failed:`, err)
            tracker.recordFailed(userId, id)
            scheduleRetry()
          }
        )
    }
    // En una tanda, de la más común a la más rara: la legendaria cierra.
    const rank = (id) => RARITIES[getAchievementDef(id)?.rarity]?.order ?? 0
    const celebrate = step.celebrate.filter((id) => getAchievementDef(id)).sort((a, b) => rank(a) - rank(b))
    if (celebrate.length) {
      setQueue((q) => {
        const ids = q.filter((x) => x.userId === userId).map((x) => x.id)
        const next = enqueue(ids, celebrate)
        return next === ids ? q : next.map((id) => ({ userId, id }))
      })
    }
  }, [ready, userId, plan, actions, tick, scheduleRetry])

  // Solo la persona actual: si cambia la sesión, se descarta lo pendiente.
  const current = queue.find((x) => x.userId === userId) || null
  const pendingCount = queue.filter((x) => x.userId === userId).length

  // Una pausa breve antes de la primera de cada tanda.
  useEffect(() => {
    if (!current) {
      setVisible(false)
      setShown(0)
      return
    }
    if (visible) return
    // Espera a que se cierre cualquier otra capa (hoja de registro, novedades…).
    let t
    const tryShow = () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        t = setTimeout(tryShow, 700)
        return
      }
      setVisible(true)
    }
    t = setTimeout(tryShow, SHOW_DELAY)
    return () => clearTimeout(t)
  }, [current, visible])

  const next = useCallback(() => {
    setQueue((q) => q.slice(1))
    setShown((n) => n + 1)
  }, [])

  const openAlbum = useCallback(() => {
    const highlight = queue.filter((x) => x.userId === userId).map((x) => x.id)
    setQueue([])
    navigate('/logros', { state: { highlight } })
  }, [queue, userId, navigate])

  if (!current || !visible) return null
  return (
    <StickCelebration
      achievement={getAchievementDef(current.id)}
      userId={userId}
      position={shown + 1}
      total={shown + pendingCount}
      onNext={next}
      onOpenAlbum={openAlbum}
    />
  )
}

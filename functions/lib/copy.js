// Push notification copy — pure builders (no Firebase imports) so they can be
// unit-tested offline. Every builder returns { title, body, tag, link } or
// null when nothing should be sent.
//
// Voice (plan §6): neutral Spanish with tú (NEVER voseo: no "podés", "elegí"),
// short, celebratory without overdoing it, never shaming. No fines, pot,
// lives or shields anywhere: that game is over.

import { USER_GENDER } from '../game/constants.js'

export const APP_URL = 'https://fitness.jaguridi.cl/'
export const APP_ICON = 'https://fitness.jaguridi.cl/avatars/jose.png'

// HashRouter routes (plan §5).
export const LINKS = {
  today: `${APP_URL}#/`,
  family: `${APP_URL}#/familia`,
  stickers: `${APP_URL}#/logros`,
  goals: `${APP_URL}#/metas`,
  member: (userId) => `${APP_URL}#/u/${userId}`,
}

export const TAGS = {
  reminder: 'fitfamily-reminder',
  habits: 'fitfamily-habits',
  weekClose: 'fitfamily-weekclose',
  social: 'fitfamily-social',
  nudge: 'fitfamily-nudge',
}

/** Spanish gendered word: gword(userId, femaleForm, maleForm). */
export const gword = (userId, female, male) => (USER_GENDER[userId] === 'f' ? female : male)

export const truncate = (s, n) => {
  const str = String(s ?? '')
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}

/** "1 sesión" / "3 sesiones". */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** "a", "a y b", "a, b y c". */
export function joinList(items) {
  const list = items.filter(Boolean)
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`
}

const firstName = (user) => user?.name || 'Alguien'

/** "Yoga + Correr" from a workout's exerciseType (string or array). */
export function formatTypes(workout) {
  const t = workout?.exerciseType
  if (Array.isArray(t)) return t.filter(Boolean).join(' + ') || 'Ejercicio'
  return t || 'Ejercicio'
}

const RARITY_LABEL = { comun: 'común', rara: 'rara', epica: 'épica', legendaria: 'legendaria' }

// ── Scheduled reminders ──────────────────────────────────────

/** Monday 09:00: the member's own weekly goal + how many habits they track. */
export function kickoffCopy(user, { goal, habitsCount }) {
  const habits = habitsCount > 0
    ? ` Y ${plural(habitsCount, 'hábito', 'hábitos')} para ir marcando.`
    : ''
  return {
    title: '💪 Nueva semana',
    body: `Hola ${firstName(user)}, tu meta es de ${plural(goal, 'sesión', 'sesiones')} esta semana.${habits} ¡Vamos!`,
    tag: TAGS.reminder,
    link: LINKS.today,
  }
}

/** Thursday 09:00, only when clearly behind. */
export function midweekCopy(user, { sessions, goal, remaining, daysLeft }) {
  return {
    title: '⏰ Mitad de semana',
    body: `${firstName(user)}, llevas ${sessions} de ${goal}. Te ${remaining === 1 ? 'falta' : 'faltan'} ` +
      `${plural(remaining, 'sesión', 'sesiones')} y quedan ${plural(daysLeft, 'día', 'días')}: todavía se puede.`,
    tag: TAGS.reminder,
    link: LINKS.today,
  }
}

/** Sunday 17:00, when the goal is still open. */
export function lastCallCopy(user, { remaining }) {
  return {
    title: '🏁 Último día de la semana',
    body: `${firstName(user)}, te ${remaining === 1 ? 'falta' : 'faltan'} ${plural(remaining, 'sesión', 'sesiones')} ` +
      'para lograr tu meta. ¡Hoy es el día!',
    tag: TAGS.reminder,
    link: LINKS.today,
  }
}

/** Daily 20:30: active habits still unchecked today. habits: [{ name, emoji }]. */
export function habitReminderCopy(user, habits) {
  if (!habits.length) return null
  const label = (h) => [h.emoji, h.name].filter(Boolean).join(' ')
  const body = habits.length === 1
    ? `${firstName(user)}, ¿ya hiciste "${label(habits[0])}" hoy? Márcalo antes de dormir.`
    : habits.length <= 3
      ? `${firstName(user)}, te quedan por marcar hoy: ${joinList(habits.map(label))}.`
      : `${firstName(user)}, te quedan ${habits.length} hábitos por marcar hoy. ¡Un toque y listo!`
  return { title: '✅ Tus hábitos de hoy', body, tag: TAGS.habits, link: LINKS.today }
}

// ── Week close result ────────────────────────────────────────

/** Personal result of a closed week. result: a week_posts result row. */
export function weekResultCopy(user, result) {
  const { status, sessions, goal, streak } = result
  if (status === 'completed') {
    const streakText = streak > 1
      ? `Racha de ${streak} semanas seguidas. 🔥`
      : 'Primera semana de una nueva racha.'
    return {
      title: '✅ ¡Semana lograda!',
      body: `${sessions} de ${goal} sesiones. ${streakText}`,
      tag: TAGS.weekClose,
      link: LINKS.family,
    }
  }
  if (status === 'rest') {
    return {
      title: '😌 Semana de descanso',
      body: streak > 0
        ? `Descansaste y tu racha de ${plural(streak, 'semana', 'semanas')} sigue intacta. Esta semana volvemos.`
        : 'Descansaste esta semana. Cuando quieras, volvemos a sumar.',
      tag: TAGS.weekClose,
      link: LINKS.family,
    }
  }
  return {
    title: '🌱 Nueva semana, nueva oportunidad',
    body: `La semana pasada no salió (${sessions} de ${goal}). Esta semana es nueva: ` +
      `${gword(user?.id, 'tú puedes, campeona', 'tú puedes, campeón')}.`,
    tag: TAGS.weekClose,
    link: LINKS.family,
  }
}

// ── Social ───────────────────────────────────────────────────

export function workoutCreatedCopy(owner, workout) {
  const duration = Number(workout?.duration) > 0 ? `, ${workout.duration} min` : ''
  return {
    title: `💪 ${firstName(owner)} entrenó`,
    body: `${formatTypes(workout)}${duration}. ¡A seguirle el ritmo!`,
    tag: TAGS.social,
    link: LINKS.family,
  }
}

// What each commentable target is called in "comentó tu …" / "a tu …".
const TARGET_NOUN = {
  workout: (doc) => `${formatTypes(doc)}${doc?.date ? ` del ${doc.date}` : ''}`,
  unlock: (doc) => `lámina ${doc?.name || ''}`.trim(),
  goal: (doc) => `meta ${[doc?.emoji, doc?.title].filter(Boolean).join(' ')}`.trim(),
}

const TARGET_SHORT = { workout: 'tu ejercicio', unlock: 'tu lámina', goal: 'tu meta' }

/** New comment on a member's own item (workout | unlock | goal). */
export function commentCopy(kind, author, comment) {
  return {
    title: `💬 ${firstName(author)} comentó ${TARGET_SHORT[kind] || 'tu publicación'}`,
    body: truncate(comment?.text, 120),
    tag: TAGS.social,
    link: LINKS.family,
  }
}

/** New reaction on a member's own item (workout | unlock | goal). */
export function reactionCopy(kind, reactor, emoji, doc) {
  const noun = TARGET_NOUN[kind]?.(doc) || 'publicación'
  return {
    title: `${emoji} ${firstName(reactor)} reaccionó`,
    body: `A tu ${noun}.`,
    tag: TAGS.social,
    link: LINKS.family,
  }
}

/** New comment on the family's weekly result card. */
export function weekPostCommentCopy(author, comment, weekId) {
  return {
    title: `💬 ${firstName(author)} comentó el resultado de la semana`,
    body: truncate(comment?.text, 120) || weekId,
    tag: TAGS.social,
    link: LINKS.family,
  }
}

/** "🏅 Jose ganó la lámina 🔥 Racha de 4" */
export function unlockCopy(owner, unlock) {
  const sticker = [unlock?.icon, unlock?.name].filter(Boolean).join(' ') || 'nueva'
  const rarity = RARITY_LABEL[unlock?.rarity]
  const number = Number.isFinite(Number(unlock?.number)) && unlock?.number != null ? `N.º ${unlock.number}` : ''
  const detail = [unlock?.description, [number, rarity ? `lámina ${rarity}` : ''].filter(Boolean).join(', ')]
    .filter(Boolean).join('. ')
  return {
    title: `🏅 ${firstName(owner)} ganó la lámina ${sticker}`,
    body: detail ? `${detail}.` : '¡Una más para el álbum!',
    tag: TAGS.social,
    link: LINKS.family,
  }
}

const goalLabel = (goal) => [goal?.emoji, goal?.title].filter(Boolean).join(' ') || 'una meta'

export function goalCreatedCopy(owner, goal) {
  const reward = goal?.reward ? ` Si lo logra: ${truncate(goal.reward, 80)}` : ''
  return {
    title: `🎯 ${firstName(owner)} se propuso una meta`,
    body: `${goalLabel(goal)}.${reward}`,
    tag: TAGS.social,
    link: LINKS.family,
  }
}

export function goalAchievedCopy(owner, goal) {
  const tail = goal?.reward
    ? ` Y se ganó: ${truncate(goal.reward, 80)} 🎁`
    : gword(owner?.id, ' ¡Felicítala en el feed!', ' ¡Felicítalo en el feed!')
  return {
    title: `🏆 ${firstName(owner)} logró su meta`,
    body: `${goalLabel(goal)}.${tail}`,
    tag: TAGS.social,
    link: LINKS.family,
  }
}

// ── Nudge ────────────────────────────────────────────────────

export const NUDGE_MESSAGES = [
  (s) => `${s} te manda un empujón 💪 ¡A moverse!`,
  (s) => `${s} dice: "¡No te quedes atrás!" 🏃`,
  (s) => `${s} te reta a entrenar hoy 🔥`,
  (s) => `${s} cree en ti... pero necesita verte sudar 😤`,
  (s) => `${s} pregunta: "¿Y esa sesión para cuándo?" 👀`,
  (s) => `${s} ya entrenó y te está esperando 😎`,
]

export function nudgeCopy(senderName, random = Math.random) {
  const pick = NUDGE_MESSAGES[Math.floor(random() * NUDGE_MESSAGES.length) % NUDGE_MESSAGES.length]
  return { title: '👊 ¡Empujón FitFamily!', body: pick(truncate(senderName, 40)), tag: TAGS.nudge, link: LINKS.today }
}

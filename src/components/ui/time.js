/**
 * Utilidades de fecha para la interfaz (sin dependencias de datos).
 *
 *   toDate(firestoreTimestamp | Date | number | 'iso')  → Date | null
 *   timeAgo(createdAt)                                    → 'recién', 'hace 5 min', 'hace 3 h', 'ayer', 'hace 4 días', '12 nov'
 */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

export function timeAgo(value, now = new Date()) {
  const d = toDate(value)
  if (!d) return ''
  const s = Math.round((now - d) / 1000)
  if (s < 60) return 'recién'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

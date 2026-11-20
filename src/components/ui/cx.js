/**
 * cx — junta clases condicionales.
 *
 *   cx('px-4', active && 'text-ink', disabled ? 'opacity-50' : null) // 'px-4 text-ink'
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** Hash entero estable (FNV-1a) para derivar formas y rotaciones de un id. */
export function hashString(str = '') {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

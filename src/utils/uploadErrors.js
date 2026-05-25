/**
 * Turns a Firebase Storage / Firestore / browser error into a user-friendly
 * Spanish message. Designed for the photo-upload flow where the generic
 * "Error al guardar" message hides the real cause from users.
 *
 * Most common Android Chrome failures fall into one of these buckets:
 *   - Device or browser is out of storage   → tell user to free space
 *   - Firebase Storage quota exceeded       → admin issue (Spark plan limit)
 *   - Not authorized                         → rules issue
 *   - Network / offline                      → connection issue
 *   - Unknown                                → fall back to a hint
 */
export function describeUploadError(err) {
  if (!err) return 'Error al guardar. Intenta de nuevo.'

  const code = err.code || ''
  const name = err.name || ''
  const message = (err.message || '').toLowerCase()

  // Browser quota (IndexedDB / localStorage / sessionStorage) — common on
  // Android Chrome when device storage is low.
  if (
    name === 'QuotaExceededError' ||
    code === 'QUOTA_EXCEEDED_ERR' ||
    message.includes('quota') && (message.includes('exceed') || message.includes('disk'))
  ) {
    return 'No queda espacio en tu teléfono o navegador. Libera almacenamiento (borra fotos viejas o caché del navegador) y vuelve a intentarlo.'
  }

  // Firebase Storage errors
  if (code.startsWith('storage/')) {
    switch (code) {
      case 'storage/quota-exceeded':
        return 'El almacenamiento del servidor está lleno. Avísale a José para que libere espacio o suba el plan de Firebase.'
      case 'storage/unauthorized':
      case 'storage/unauthenticated':
        return 'No tienes permiso para subir fotos. Cierra sesión y vuelve a entrar.'
      case 'storage/retry-limit-exceeded':
      case 'storage/canceled':
        return 'La subida tardó demasiado. Revisa tu conexión e intenta de nuevo.'
      case 'storage/object-not-found':
      case 'storage/bucket-not-found':
      case 'storage/project-not-found':
        return 'Error de configuración. Avísale a José.'
      case 'storage/invalid-argument':
      case 'storage/invalid-checksum':
      case 'storage/server-file-wrong-size':
        return 'La foto se dañó al subirla. Vuelve a tomarla y reintenta.'
      default:
        return `Error al subir foto (${code}). Intenta de nuevo o avísale a José.`
    }
  }

  // Firestore errors
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'No hay conexión. Tu sesión se guardará apenas vuelvas a tener internet.'
  }
  if (code === 'permission-denied') {
    return 'No tienes permiso para guardar. Cierra sesión y vuelve a entrar.'
  }

  // Network-ish fallback
  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'Sin conexión. Revisa tu internet y reintenta.'
  }

  // Generic fallback — keep close to the old text so it doesn't surprise users
  return 'Error al guardar. Revisa tu conexión e inténtalo de nuevo.'
}

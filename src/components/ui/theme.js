import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Preferencia de tema: 'system' | 'light' | 'dark', guardada en localStorage
 * (`fitfamily_theme`) y aplicada como data-theme en <html>. El script en línea de
 * index.html la aplica antes del primer pintado; este módulo la mantiene viva.
 *
 *   const { preference, setPreference, resolved } = useTheme()
 *   <SegmentedControl value={preference} onChange={setPreference} options={THEME_OPTIONS} />
 */

export const THEME_KEY = 'fitfamily_theme'
export const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

const META_COLORS = { light: '#F2F4F7', dark: '#0E1528' }
const listeners = new Set()

function readPreference() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function applyTheme(preference) {
  const root = document.documentElement
  if (preference === 'light' || preference === 'dark') root.setAttribute('data-theme', preference)
  else root.removeAttribute('data-theme')
  const resolved = preference === 'system' ? (systemDark() ? 'dark' : 'light') : preference
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (preference === 'system') {
      const media = m.getAttribute('media') || ''
      m.setAttribute('content', media.includes('dark') ? META_COLORS.dark : META_COLORS.light)
    } else {
      m.setAttribute('content', META_COLORS[resolved])
    }
  })
  return resolved
}

export function setThemePreference(preference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, preference)
  } catch {
    /* modo privado: igual se aplica en esta sesión */
  }
  applyTheme(preference)
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  mq?.addEventListener?.('change', cb)
  return () => {
    listeners.delete(cb)
    mq?.removeEventListener?.('change', cb)
  }
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system')
  const isSystemDark = useSyncExternalStore(subscribe, systemDark, () => false)
  const resolved = preference === 'system' ? (isSystemDark ? 'dark' : 'light') : preference
  const setPreference = useCallback((p) => setThemePreference(p), [])
  return { preference, setPreference, resolved }
}

/** Solo el tema resuelto ('light' | 'dark'), p. ej. para sonner. */
export function useResolvedTheme() {
  return useTheme().resolved
}

/** Sincroniza la meta theme-color si cambia el sistema estando en 'system'. */
export function useThemeSync() {
  const { preference, resolved } = useTheme()
  useEffect(() => {
    applyTheme(preference)
  }, [preference, resolved])
}

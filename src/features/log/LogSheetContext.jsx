import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Abre la hoja "Registrar ejercicio" desde cualquier pantalla.
 *
 *   const { openLog } = useLogSheet()
 *   <Button onClick={() => openLog()}>Registrar ejercicio</Button>
 *   openLog({ date: '2026-11-18' })        // valores iniciales opcionales para el formulario
 *
 * La hoja (<LogSheet />) se monta una sola vez en App y lee { open, initial, closeLog }.
 */
const LogSheetContext = createContext(null)

export function LogSheetProvider({ children }) {
  const [state, setState] = useState({ open: false, initial: null })
  const openLog = useCallback((initial = null) => setState({ open: true, initial }), [])
  const closeLog = useCallback(() => setState((s) => ({ ...s, open: false })), [])
  const value = useMemo(() => ({ ...state, openLog, closeLog }), [state, openLog, closeLog])
  return <LogSheetContext.Provider value={value}>{children}</LogSheetContext.Provider>
}

export function useLogSheet() {
  const ctx = useContext(LogSheetContext)
  if (!ctx) throw new Error('useLogSheet debe usarse dentro de <LogSheetProvider>')
  return ctx
}

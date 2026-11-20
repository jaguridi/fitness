import { Toaster as SonnerToaster } from 'sonner'
import { useResolvedTheme } from './theme'

/**
 * Toaster — sonner con los tokens del sistema. Móntalo una vez (App ya lo hace).
 * Para avisar, usa `toast` de sonner directamente:
 *
 *   import { toast } from 'sonner'
 *   toast.success('Ejercicio registrado')
 *   toast('Semana de descanso marcada', { description: 'No suma ni rompe tu racha.' })
 *   toast.error('No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.')
 *
 * El texto nombra lo que pasó con el mismo verbo del botón ("Registrar ejercicio" → "Ejercicio registrado").
 */
export default function Toaster() {
  const theme = useResolvedTheme()
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      offset="max(12px, env(safe-area-inset-top))"
      gap={8}
      style={{
        '--normal-bg': 'var(--surface)',
        '--normal-text': 'var(--ink)',
        '--normal-border': 'var(--line)',
        '--success-bg': 'var(--surface)',
        '--success-text': 'var(--ink)',
        '--success-border': 'var(--line)',
        '--error-bg': 'var(--surface)',
        '--error-text': 'var(--ink)',
        '--error-border': 'var(--line)',
        '--border-radius': '16px',
        fontFamily: 'var(--font-sans)',
      }}
      toastOptions={{
        classNames: {
          toast: '!shadow-lift !gap-2.5 !text-[15px] !font-semibold',
          description: '!text-ink-soft !font-normal !text-sm',
          success: '[&_[data-icon]]:!text-done',
          error: '[&_[data-icon]]:!text-danger',
        },
      }}
    />
  )
}

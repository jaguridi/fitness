import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Button, Chip, inputClass } from '../../components/ui'
import { normalizeSportName, VISIBLE_TYPES } from './logForm'

/**
 * Chips de tipo de ejercicio (se pueden elegir varios). Muestra primero los que la
 * persona más usa; el resto queda tras "Más deportes". "Agregar otro" crea un deporte
 * para toda la familia (actions.addCustomSport) y lo deja elegido.
 *
 * @param {string[]} types     todos los tipos, ya ordenados (orderExerciseTypes)
 * @param {string[]} selected
 * @param {(next:string[])=>void} onChange
 * @param {(name:string)=>Promise<void>} onAddCustom
 */
export default function ExerciseTypePicker({ types, selected, onChange, onAddCustom, disabled }) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const toggle = (t) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t])

  const visible = expanded
    ? types
    : [...types.slice(0, VISIBLE_TYPES), ...types.slice(VISIBLE_TYPES).filter((t) => selected.includes(t))]
  const hiddenCount = types.length - visible.length

  const add = async () => {
    setError('')
    const clean = normalizeSportName(name)
    if (!clean) {
      setError('Escribe el nombre del deporte.')
      return
    }
    if (clean.length > 30) {
      setError('Usa un nombre más corto (hasta 30 letras).')
      return
    }
    const existing = types.find((t) => t.toLowerCase() === clean.toLowerCase())
    if (existing) {
      if (!selected.includes(existing)) onChange([...selected, existing])
      setExpanded(true)
      setName('')
      setAdding(false)
      return
    }
    setSaving(true)
    try {
      await onAddCustom(clean)
      onChange([...selected, clean])
      setExpanded(true)
      setName('')
      setAdding(false)
    } catch (err) {
      console.error('addCustomSport error:', err)
      setError('No se pudo guardar el deporte. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-small mb-1.5 font-semibold text-ink">
        Tipo de ejercicio <span className="font-normal text-ink-soft">(puedes elegir varios)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {visible.map((t) => (
          <Chip key={t} selected={selected.includes(t)} onClick={() => toggle(t)} disabled={disabled}>
            {t}
          </Chip>
        ))}
        {hiddenCount > 0 && (
          <Chip icon={ChevronDown} onClick={() => setExpanded(true)} aria-pressed={undefined} className="text-ink-soft">
            Más deportes
          </Chip>
        )}
        {!adding && (
          <Chip icon={Plus} onClick={() => setAdding(true)} aria-pressed={undefined} className="border-dashed text-ink-soft" disabled={disabled}>
            Agregar otro
          </Chip>
        )}
      </div>
      {adding && (
        <div className="mt-1 flex flex-col gap-1.5">
          <label htmlFor="log-new-sport" className="sr-only">
            Nombre del deporte nuevo
          </label>
          <div className="flex gap-2">
            <input
              id="log-new-sport"
              ref={inputRef}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder="Por ejemplo, Surf"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'log-new-sport-error' : 'log-new-sport-hint'}
              className={`${inputClass(error)} h-11 min-w-0 flex-1`}
            />
            <Button onClick={add} loading={saving} variant="secondary">
              Agregar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false)
                setName('')
                setError('')
              }}
            >
              Cancelar
            </Button>
          </div>
          {error ? (
            <p id="log-new-sport-error" className="type-small text-danger">
              {error}
            </p>
          ) : (
            <p id="log-new-sport-hint" className="type-small text-ink-soft">
              Queda disponible para toda la familia.
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}

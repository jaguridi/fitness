import { useEffect, useRef, useState } from 'react'
import { EXERCISE_TYPES } from '../constants'
import { subscribeCustomSports, addCustomSport } from '../services/firebaseService'

/**
 * Multi-select exercise-type chips, shared by WorkoutLogger and
 * WorkoutEditModal. Includes the family's custom sports (Firestore doc
 * settings/customSports) and a "+ Agregar" chip to create new ones —
 * a sport added by one family member appears for everyone.
 */
export default function ExerciseTypePicker({ selected, onChange }) {
  const [customSports, setCustomSports] = useState([])
  const [adding, setAdding] = useState(false)
  const [newSport, setNewSport] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const unsub = subscribeCustomSports(setCustomSports, (err) =>
      console.error('customSports subscribe error:', err)
    )
    return unsub
  }, [])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  // 'Otro' stays last; custom sports slot in before it.
  const allTypes = [
    ...EXERCISE_TYPES.filter((t) => t !== 'Otro'),
    ...customSports.filter((t) => !EXERCISE_TYPES.includes(t)),
    'Otro',
  ]

  const toggle = (t) => {
    onChange(
      selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]
    )
  }

  const handleAdd = async () => {
    setAddError('')
    const raw = newSport.trim().replace(/\s+/g, ' ')
    if (!raw) return
    const name = raw.charAt(0).toUpperCase() + raw.slice(1)

    // If it already exists (any casing), just select it instead of duplicating.
    const existing = allTypes.find((t) => t.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selected.includes(existing)) onChange([...selected, existing])
      setNewSport('')
      setAdding(false)
      return
    }

    setSaving(true)
    try {
      await addCustomSport(name)
      onChange([...selected, name])
      setNewSport('')
      setAdding(false)
    } catch (err) {
      console.error('addCustomSport error:', err)
      setAddError('No se pudo guardar el deporte. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {allTypes.map((t) => {
          const isSelected = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                isSelected
                  ? 'bg-indigo-600 text-white ring-1 ring-indigo-400'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isSelected && '✓ '}
              {t}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 bg-gray-700/60 text-indigo-300 border border-dashed border-indigo-500/50 hover:bg-gray-600"
        >
          {adding ? '✕ Cancelar' : '+ Agregar'}
        </button>
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newSport}
            onChange={(e) => setNewSport(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            maxLength={25}
            placeholder="Nombre del deporte"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={saving || !newSport.trim()}
            onClick={handleAdd}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? '⏳' : 'Guardar'}
          </button>
        </div>
      )}
      {addError && <p className="mt-1 text-xs text-red-400">{addError}</p>}
    </div>
  )
}

import { useState, useMemo } from 'react'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * Monthly calendar view: grid of days for the selected month, with workout
 * photo thumbnails on the days where activity was logged. Includes a
 * prev/next month navigator. Tapping a day with a photo opens fullscreen.
 */
export default function MonthCalendar({ workouts, onSelectPhoto }) {
  const initial = workouts?.[0]?.date
    ? new Date(workouts[0].date + 'T12:00:00')
    : new Date()
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))

  const { grid, monthLabel, stats } = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const daysInMonth = monthEnd.getDate()
    const firstDow = (monthStart.getDay() || 7) - 1 // Monday=0 ... Sunday=6

    // Bucket workouts by date string within this month
    const byDay = {}
    for (const w of workouts || []) {
      if (!w.date) continue
      const d = new Date(w.date + 'T12:00:00')
      if (d.getFullYear() !== year || d.getMonth() !== month) continue
      const key = w.date
      if (!byDay[key]) byDay[key] = []
      byDay[key].push(w)
    }

    // Build leading blanks + days + trailing blanks to fill last row
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, ymd, workouts: byDay[ymd] || [] })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    // Stats for this month
    const activeWorkouts = Object.values(byDay).flat()
    const activeDays = Object.keys(byDay).length
    const totalMinutes = activeWorkouts.reduce((s, w) => s + (w.duration || 0), 0)
    const totalCalories = activeWorkouts.reduce((s, w) => s + (w.calories || 0), 0)

    return {
      grid: cells,
      monthLabel: `${MONTH_NAMES[month]} ${year}`,
      stats: { activeDays, totalMinutes, totalCalories, totalWorkouts: activeWorkouts.length },
    }
  }, [cursor, workouts])

  const prev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
  const next = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))

  const today = new Date()
  const isCurrentMonth =
    today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth()
  const todayKey = isCurrentMonth ? today.getDate() : null

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header with nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <button
          onClick={prev}
          className="w-8 h-8 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <div className="text-center">
          <p className="font-bold text-white text-sm capitalize">📆 {monthLabel}</p>
          <p className="text-[11px] text-gray-500">
            {stats.activeDays} día(s) activos · {stats.totalWorkouts} sesión(es)
          </p>
        </div>
        <button
          onClick={next}
          className="w-8 h-8 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400"
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 px-2 py-2 border-b border-gray-700/50">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-gray-500 font-semibold">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 p-2">
        {grid.map((cell, idx) => {
          if (!cell) {
            return <div key={idx} className="aspect-square" />
          }
          const hasWorkout = cell.workouts.length > 0
          const firstPhoto = cell.workouts.find((w) => w.photoURL)?.photoURL
          const isToday = cell.day === todayKey
          return (
            <button
              key={idx}
              type="button"
              disabled={!hasWorkout}
              onClick={() => {
                if (firstPhoto) onSelectPhoto?.(firstPhoto)
              }}
              className={`aspect-square relative rounded-md overflow-hidden transition-all ${
                hasWorkout
                  ? 'ring-1 ring-indigo-600/40 hover:ring-indigo-500 active:scale-95'
                  : 'bg-gray-900/40'
              } ${isToday ? 'ring-2 ring-amber-400' : ''}`}
              title={hasWorkout ? `${cell.workouts.length} sesión(es)` : ''}
            >
              {firstPhoto ? (
                <>
                  <img
                    src={firstPhoto}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </>
              ) : null}
              <span
                className={`absolute top-0.5 left-1 text-[10px] font-bold ${
                  hasWorkout ? 'text-white' : 'text-gray-500'
                }`}
              >
                {cell.day}
              </span>
              {cell.workouts.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {cell.workouts.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer stats */}
      {stats.totalWorkouts > 0 && (
        <div className="grid grid-cols-3 gap-px bg-gray-700/30 border-t border-gray-700/50">
          <div className="bg-gray-800 p-2 text-center">
            <p className="text-sm font-bold text-white">{stats.activeDays}</p>
            <p className="text-[10px] text-gray-500">días</p>
          </div>
          <div className="bg-gray-800 p-2 text-center">
            <p className="text-sm font-bold text-cyan-400">
              {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
            </p>
            <p className="text-[10px] text-gray-500">tiempo</p>
          </div>
          <div className="bg-gray-800 p-2 text-center">
            <p className="text-sm font-bold text-orange-400">
              {stats.totalCalories >= 1000
                ? `${(stats.totalCalories / 1000).toFixed(1)}k`
                : stats.totalCalories || '—'}
            </p>
            <p className="text-[10px] text-gray-500">kcal</p>
          </div>
        </div>
      )}
    </div>
  )
}

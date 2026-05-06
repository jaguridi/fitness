import { useState, useEffect } from 'react'
import { getWorkoutsByUser } from '../services/firebaseService'

const DAYS_TO_SHOW = 16 * 7 // ~16 weeks
const DAY_LABELS = ['', 'L', '', 'M', '', 'V', '']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * GitHub-style activity heatmap for a user.
 * Shows the last ~16 weeks of activity with color intensity.
 */
export default function ActivityHeatmap({ userId }) {
  const [grid, setGrid] = useState(null)
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    getWorkoutsByUser(userId)
      .then((workouts) => {
        if (cancelled) return
        const { cells, monthLabels } = buildGrid(workouts)
        setGrid(cells)
        setMonths(monthLabels)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  if (loading || !grid) return null

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-bold text-white text-sm">Actividad</h3>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        {/* Month labels */}
        <div className="flex mb-1 ml-6">
          {months.map((m, i) => (
            <span
              key={i}
              className="text-xs text-gray-500"
              style={{ width: `${m.span * 14}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex gap-0.5">
          {/* Day labels column */}
          <div className="flex flex-col gap-0.5 mr-1 shrink-0">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="h-[12px] flex items-center">
                <span className="text-[10px] text-gray-600 w-4 text-right">{d}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day.date ? `${day.date}: ${day.count} sesión(es)` : ''}
                  className={`w-[12px] h-[12px] rounded-sm ${
                    !day.date
                      ? 'bg-transparent'
                      : day.count === 0
                      ? 'bg-gray-700/60'
                      : day.count === 1
                      ? 'bg-green-800'
                      : day.count === 2
                      ? 'bg-green-600'
                      : 'bg-green-400'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-gray-500">Menos</span>
          <div className="w-[12px] h-[12px] rounded-sm bg-gray-700/60" />
          <div className="w-[12px] h-[12px] rounded-sm bg-green-800" />
          <div className="w-[12px] h-[12px] rounded-sm bg-green-600" />
          <div className="w-[12px] h-[12px] rounded-sm bg-green-400" />
          <span className="text-[10px] text-gray-500">Más</span>
        </div>
      </div>
    </div>
  )
}

function buildGrid(workouts) {
  // Count workouts per date
  const countByDate = {}
  for (const w of workouts) {
    if (w.date) {
      countByDate[w.date] = (countByDate[w.date] || 0) + 1
    }
  }

  // Build date range: last DAYS_TO_SHOW days, aligned to weeks (Mon start)
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  // Find the last Sunday (end of display)
  const endDay = new Date(today)

  // Find start: go back DAYS_TO_SHOW days, then align to Monday
  const startDay = new Date(today)
  startDay.setDate(startDay.getDate() - DAYS_TO_SHOW)
  const startDow = startDay.getDay() || 7 // 1=Mon..7=Sun
  startDay.setDate(startDay.getDate() - (startDow - 1)) // align to Monday

  // Build weeks array (each week = 7 days Mon-Sun)
  const weeks = []
  const monthSpans = []
  let currentMonth = -1
  let monthWeekCount = 0

  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDate(cursor)
      const isFuture = cursor > today

      if (isFuture) {
        week.push({ date: null, count: 0 })
      } else {
        week.push({ date: dateStr, count: countByDate[dateStr] || 0 })
      }

      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)

    // Track month labels
    const weekMonth = new Date(cursor)
    weekMonth.setDate(weekMonth.getDate() - 4) // mid-week
    const m = weekMonth.getMonth()
    if (m !== currentMonth) {
      if (currentMonth >= 0) {
        monthSpans.push({ label: MONTH_NAMES[currentMonth], span: monthWeekCount })
      }
      currentMonth = m
      monthWeekCount = 1
    } else {
      monthWeekCount++
    }
  }
  // Push last month
  if (currentMonth >= 0) {
    monthSpans.push({ label: MONTH_NAMES[currentMonth], span: monthWeekCount })
  }

  return { cells: weeks, monthLabels: monthSpans }
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

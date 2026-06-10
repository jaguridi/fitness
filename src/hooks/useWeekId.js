import { useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
// Week arithmetic lives in src/game/weekId.js (pure module shared with Cloud
// Functions); re-exported here so existing imports keep working unchanged.
import { getWeekId, getWeekRange } from '../game/weekId.js'

export {
  getWeekId,
  getWeekRange,
  getAdjacentWeeks,
  getPreviousWeekId,
  getNextWeekId,
  getWeeksBetween,
  getRecoveryWindow,
  isDateInWeek,
} from '../game/weekId.js'

export function formatWeekLabel(weekId) {
  const { start, end } = getWeekRange(weekId)
  return `${format(start, "d 'de' MMM", { locale: es })} - ${format(end, "d 'de' MMM", { locale: es })}`
}

export default function useWeekId() {
  const currentWeekId = useMemo(() => getWeekId(), [])
  return {
    currentWeekId,
    getWeekId,
    getWeekRange,
    formatWeekLabel,
  }
}

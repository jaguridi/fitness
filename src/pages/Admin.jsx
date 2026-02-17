import AbsencePlanner from '../components/AbsencePlanner'
import WeeklyHistory from '../components/WeeklyHistory'
import WeekEndProcessor from '../components/WeekEndProcessor'

export default function Admin({ gameState }) {
  const { processWeekEnd, currentWeekId } = gameState

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-2xl font-black text-white text-center">⚙️ Administración</h2>

      <WeekEndProcessor
        onProcess={processWeekEnd}
        currentWeekId={currentWeekId}
      />

      <AbsencePlanner />

      <WeeklyHistory />
    </div>
  )
}

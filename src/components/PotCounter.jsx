import { formatCLP } from '../constants'

export default function PotCounter({ total }) {
  return (
    <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-4 shadow-lg text-center">
      <p className="text-sm text-amber-100 font-medium">💰 Pozo Total Recaudado</p>
      <p className="text-3xl font-black text-white mt-1">{formatCLP(total)}</p>
    </div>
  )
}

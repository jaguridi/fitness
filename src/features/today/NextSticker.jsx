import { Link } from 'react-router-dom'
import { ProgressBar, Section, Sticker } from '../../components/ui'
import { useAchievements } from '../../data/FamilyDataProvider'
import { pickNextSticker } from './todayCopy'

/** "Próxima lámina": la lámina sin ganar más cerca de completarse. Toque → álbum. */
export default function NextSticker({ userId }) {
  const next = pickNextSticker(useAchievements(userId))
  if (!next) return null
  const { current, target } = next.progress
  const left = target - current
  return (
    <Section title="Próxima lámina">
      <Link
        to="/logros"
        className="flex items-center gap-4 rounded-surface border border-line bg-surface p-4 transition-[border-color,transform] duration-150 hover:border-line-strong active:scale-[0.99]"
      >
        <Sticker id={next.id} number={next.number} name={next.name} rarity={next.rarity} size="sm" showLabel={false} />
        <span className="min-w-0 flex-1">
          <span className="type-body block font-semibold text-ink">{next.name}</span>
          {next.description && <span className="type-small block text-ink-soft">{next.description}</span>}
          <ProgressBar value={current} max={target} userId={userId} size="sm" label={next.name} className="mt-2.5" />
          <span className="type-caption mt-1.5 block tabular-nums text-ink-soft">
            {current.toLocaleString('es-CL')} de {target.toLocaleString('es-CL')}
            {left > 0 && left <= 2 ? `, ${left === 1 ? 'te falta 1' : 'te faltan 2'}` : ''}
          </span>
        </span>
      </Link>
    </Section>
  )
}

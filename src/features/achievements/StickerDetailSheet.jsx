import { CalendarCheck } from 'lucide-react'
import { Avatar, ProgressBar, Sheet, Sticker, memberProps } from '../../components/ui'
import { earnedDateLabel, formatProgress, isMeasurable } from './albumUtils'
import { RarityTag } from './albumParts'

/**
 * Detalle de una lámina: grande, nombre, rareza, cómo se gana, progreso o fecha,
 * y quiénes de la familia ya la tienen.
 *
 * @param {object|null} achievement  ítem de getAchievements (o null = cerrada)
 * @param {object} owner             miembro dueño del álbum que se está mirando
 * @param {boolean} isMe             el álbum es de quien usa la app
 * @param {{id,name,avatar}[]} owners miembros que la tienen
 */
export default function StickerDetailSheet({ achievement: a, owner, isMe, owners = [], onClose }) {
  const open = !!a
  return (
    <Sheet open={open} onClose={onClose} title={a?.name || 'Lámina'}>
      {a && <DetailBody a={a} owner={owner} isMe={isMe} owners={owners} />}
    </Sheet>
  )
}

function DetailBody({ a, owner, isMe, owners }) {
  const date = earnedDateLabel(a)
  const progress = formatProgress(a)
  const who = isMe ? 'Tú' : owner?.name
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <RarityTag rarity={a.rarity} />
        <span className="type-small tabular-nums text-ink-soft">Lámina {a.number}</span>
      </div>

      <div className="mt-3 flex justify-center rounded-surface bg-surface-sunk py-7">
        <Sticker
          id={a.id}
          icon={a.icon}
          name={a.name}
          number={a.number}
          rarity={a.rarity}
          earned={a.earned}
          size="lg"
          showLabel={false}
        />
      </div>

      {a.earned ? (
        <>
          <p className="type-body mt-5 text-ink">{a.description}</p>
          <p className="type-small mt-3 flex items-center gap-2 text-ink-soft">
            <CalendarCheck size={16} strokeWidth={2.2} aria-hidden="true" className="text-done-ink" />
            {date ? `Ganada el ${date}` : 'Ganada, sin fecha'}
          </p>
        </>
      ) : (
        <>
          <h3 className="type-small mt-5 font-semibold text-ink-soft">Cómo conseguirla</h3>
          <p className="type-body mt-1 text-ink">{a.description}</p>
          {isMeasurable(a) && (
            <div className="mt-4" {...memberProps(owner?.id)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-small font-semibold text-ink">{isMe ? 'Llevas' : `${who} lleva`}</span>
                <span className="type-small tabular-nums text-ink-soft">{progress}</span>
              </div>
              <ProgressBar
                value={a.progress.current}
                max={a.progress.target}
                userId={owner?.id}
                className="mt-2"
                label={`Progreso de ${a.name}: ${progress}`}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="type-small font-semibold text-ink-soft">En la familia</h3>
        {owners.length ? (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
            {owners.map((m) => (
              <li key={m.id} className="flex items-center gap-2" {...memberProps(m.id)}>
                <Avatar userId={m.id} src={m.avatar} name="" size="sm" />
                <span className="type-small font-semibold text-member-ink">{m.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-small mt-1 text-ink-soft">Nadie la tiene todavía. Puede ser la primera de la familia.</p>
        )}
      </div>
    </div>
  )
}

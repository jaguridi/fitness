import { ChevronRight } from 'lucide-react'
import { Avatar, ProgressBar, Section, Sticker, Surface, memberProps } from '../../components/ui'
import { RARITY_IDS, RARITY_PLURAL, RaritySwatch } from './albumParts'

/**
 * Los cuatro álbumes lado a lado: cuántas lleva cada uno, qué tiene cada uno por
 * rareza, y las legendarias de la familia. En el orden de siempre (no es un ranking).
 *
 * @param {{id,name,avatar}[]} members
 * @param {{ rows, shared, owners }} comparison  familyComparison()
 * @param {object[]} catalog       lista de láminas (para nombres/íconos de las legendarias)
 * @param {(userId) => void} onOpenMember
 * @param {(achievementId) => void} onOpenSticker
 */
export default function FamilyAlbums({ members, comparison, catalog, currentUserId, onOpenMember, onOpenSticker }) {
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const legendaries = catalog.filter((a) => a.rarity === 'legendaria' && comparison.owners[a.id]?.length)
  const { shared } = comparison

  return (
    <div>
      <Section title="Los cuatro álbumes" description="Toca uno para hojearlo.">
        <Surface padding="none" className="divide-y divide-line overflow-hidden">
          {comparison.rows.map((row) => {
            const m = byId[row.userId]
            const name = row.userId === currentUserId ? 'Tú' : m?.name
            return (
              <button
                key={row.userId}
                type="button"
                onClick={() => onOpenMember(row.userId)}
                {...memberProps(row.userId)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunk"
              >
                <Avatar userId={row.userId} src={m?.avatar} name="" size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="type-body font-semibold text-member-ink">{name}</span>
                    <span className="type-small tabular-nums text-ink-soft">
                      <span className="font-semibold text-ink">{row.earned}</span> de {row.total}
                    </span>
                  </span>
                  <ProgressBar value={row.earned} max={row.total} userId={row.userId} size="sm" className="mt-2" label={`Álbum de ${m?.name}: ${row.earned} de ${row.total}`} />
                </span>
                <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-ink-faint" />
              </button>
            )
          })}
        </Surface>
        <p className="type-small mt-3 text-ink-soft">
          {shared > 0
            ? `${shared} ${shared === 1 ? 'lámina la tienen' : 'láminas las tienen'} los cuatro.`
            : 'Todavía no hay una lámina que tengan los cuatro.'}
        </p>
      </Section>

      <Section title="Por rareza" description="Cuántas de cada tipo tiene cada uno.">
        <Surface padding="none" className="overflow-hidden">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Láminas por rareza de cada miembro</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-3 pl-4">
                  <span className="sr-only">Rareza</span>
                </th>
                {comparison.rows.map((row) => (
                  <th key={row.userId} scope="col" className="w-[17%] py-3 text-center">
                    <span className="inline-flex flex-col items-center gap-1" {...memberProps(row.userId)}>
                      <Avatar userId={row.userId} src={byId[row.userId]?.avatar} name="" size="xs" />
                      <span className="type-caption font-semibold text-member-ink">
                        {row.userId === currentUserId ? 'Tú' : byId[row.userId]?.name}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...RARITY_IDS].reverse().map((r) => (
                <tr key={r} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 pl-4">
                    <span className="flex items-center gap-2.5 type-small font-semibold text-ink">
                      <RaritySwatch rarity={r} size={14} />
                      {RARITY_PLURAL[r]}
                    </span>
                  </th>
                  {comparison.rows.map((row) => {
                    const c = row.byRarity[r] || { earned: 0, total: 0 }
                    return (
                      <td key={row.userId} className="py-3 text-center tabular-nums">
                        <span className={c.earned ? 'type-body font-bold text-ink' : 'type-body text-ink-faint'}>{c.earned}</span>
                        <span className="type-caption text-ink-faint">/{c.total}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </Section>

      <Section title="Legendarias de la familia" description="Las más difíciles del álbum.">
        {legendaries.length ? (
          <ul className="flex flex-col gap-3">
            {legendaries.map((a) => {
              const ownerIds = comparison.owners[a.id] || []
              return (
                <li key={a.id}>
                  <Surface
                    as="button"
                    type="button"
                    interactive
                    padding="sm"
                    onClick={() => onOpenSticker(a.id)}
                  >
                    <span className="flex items-center gap-4">
                    <Sticker id={a.id} icon={a.icon} name={a.name} number={a.number} rarity="legendaria" earned size={64} showLabel={false} />
                    <span className="min-w-0 flex-1">
                      <span className="type-body block font-semibold text-ink">{a.name}</span>
                      <span className="mt-1.5 flex items-center gap-1.5">
                        {ownerIds.map((id) => (
                          <Avatar key={id} userId={id} src={byId[id]?.avatar} name={byId[id]?.name} size="xs" />
                        ))}
                      </span>
                    </span>
                    </span>
                  </Surface>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="type-body rounded-surface border-[1.5px] border-dashed border-line-strong px-4 py-5 text-ink-soft">
            Nadie tiene una legendaria todavía. ¿Quién pega la primera?
          </p>
        )}
      </Section>
    </div>
  )
}

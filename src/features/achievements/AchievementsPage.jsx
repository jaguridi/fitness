import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ProgressBar, SegmentedControl, Section, Sticker, Surface, cx, memberProps } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { useAchievements, useAlbumSummary, useFamily } from '../../data/FamilyDataProvider'
import { getAchievements } from '../../data/selectors'
import { ACHIEVEMENTS } from '../../domain/achievements.js'
import { closestStickers, familyComparison, formatProgress, ownersOf, shortDateLabel } from './albumUtils'
import { MemberSwitcher, RARITY_IDS, RARITY_PLURAL, RaritySwatch } from './albumParts'
import StickerDetailSheet from './StickerDetailSheet'
import FamilyAlbums from './FamilyAlbums'

/** El álbum de láminas (/logros): el tuyo o el de cualquiera, y la vista de la familia. */
export default function AchievementsPage() {
  const { currentUser } = useAuth()
  const { members, state } = useFamily()
  const location = useLocation()
  const navigate = useNavigate()
  const meId = currentUser?.id

  const [memberId, setMemberId] = useState(meId)
  const [view, setView] = useState('album')
  const [detailId, setDetailId] = useState(null)
  const [detailOwnerId, setDetailOwnerId] = useState(null)
  // Láminas que vienen de la celebración ("Verla en el álbum"): se pegan de nuevo aquí.
  const [highlight, setHighlight] = useState([])

  useEffect(() => {
    const incoming = location.state?.highlight
    if (!incoming?.length) return
    setHighlight(incoming)
    setMemberId(meId)
    setView('album')
    navigate('.', { replace: true, state: null })
  }, [location.state, meId, navigate])

  useEffect(() => {
    if (!highlight.length) return
    const t = setTimeout(() => {
      document.getElementById(`lamina-${highlight[0]}`)?.scrollIntoView({ block: 'center' })
    }, 120)
    return () => clearTimeout(t)
  }, [highlight])

  const getList = useCallback((userId) => getAchievements(state, userId), [state])
  const owner = members.find((m) => m.id === memberId) || members[0]
  const isMe = memberId === meId

  const openSticker = (id, ownerId = memberId) => {
    setDetailOwnerId(ownerId)
    setDetailId(id)
  }

  const detailOwner = members.find((m) => m.id === detailOwnerId) || owner
  const detail = detailId ? getList(detailOwner.id).find((a) => a.id === detailId) || null : null
  const detailOwnerIds = detailId ? ownersOf(members, getList, detailId) : []
  const detailOwners = members.filter((m) => detailOwnerIds.includes(m.id))

  return (
    <>
      <header className="pt-4 pb-5">
        <h1 className="type-title text-ink">{view === 'family' ? 'El álbum de la familia' : isMe ? 'Tu álbum' : `El álbum de ${owner?.name}`}</h1>
        <SegmentedControl
          className="mt-4"
          label="Qué álbum ver"
          value={view}
          onChange={setView}
          options={[
            { value: 'album', label: isMe ? 'Mío' : owner?.name || 'Álbum' },
            { value: 'family', label: 'Familia' },
          ]}
        />
      </header>

      {view === 'album' ? (
        <MemberAlbum
          key={memberId}
          members={members}
          memberId={memberId}
          meId={meId}
          isMe={isMe}
          highlight={isMe ? highlight : []}
          onChangeMember={setMemberId}
          onOpen={(id) => openSticker(id)}
        />
      ) : (
        <FamilyView
          members={members}
          meId={meId}
          getList={getList}
          onOpenMember={(id) => {
            setMemberId(id)
            setView('album')
            window.scrollTo(0, 0)
          }}
          onOpenSticker={(id) => openSticker(id, meId)}
        />
      )}

      <StickerDetailSheet
        achievement={detail}
        owner={detailOwner}
        isMe={detailOwner?.id === meId}
        owners={detailOwners}
        onClose={() => setDetailId(null)}
      />
    </>
  )
}

function FamilyView({ members, meId, getList, onOpenMember, onOpenSticker }) {
  const comparison = useMemo(() => familyComparison(members, getList), [members, getList])
  return (
    <FamilyAlbums
      members={members}
      comparison={comparison}
      catalog={ACHIEVEMENTS}
      currentUserId={meId}
      onOpenMember={onOpenMember}
      onOpenSticker={onOpenSticker}
    />
  )
}

function MemberAlbum({ members, memberId, meId, isMe, highlight, onChangeMember, onOpen }) {
  const summary = useAlbumSummary(memberId)
  const list = useAchievements(memberId)
  const upcoming = useMemo(() => closestStickers(list, 3), [list])
  const owner = members.find((m) => m.id === memberId)

  return (
    <div {...memberProps(memberId)}>
      <MemberSwitcher members={members} value={memberId} onChange={onChangeMember} currentUserId={meId} />

      {/* Portada: cuántas lleva y de qué rareza */}
      <div className="mt-6">
        <p className="flex items-baseline gap-2.5">
          <span className="type-display tabular-nums text-ink">{summary.earned}</span>
          <span className="type-sub text-ink-soft">de {summary.total} láminas</span>
        </p>
        <ProgressBar
          value={summary.earned}
          max={summary.total}
          userId={memberId}
          className="mt-3"
          label={`${summary.earned} de ${summary.total} láminas`}
        />
        <ul className="mt-5 grid grid-cols-4 gap-2" aria-label="Por rareza">
          {[...RARITY_IDS].reverse().map((r) => {
            const c = summary.byRarity[r] || { earned: 0, total: 0 }
            return (
              <li key={r} className="flex flex-col items-start gap-1.5">
                <RaritySwatch rarity={r} size={16} />
                <span className="type-sub tabular-nums text-ink">
                  {c.earned}
                  <span className="type-small text-ink-faint">/{c.total}</span>
                </span>
                <span className="type-caption text-ink-soft">{RARITY_PLURAL[r]}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {summary.latest.length > 0 && (
        <Section title={isMe ? 'Tus últimas láminas' : 'Sus últimas láminas'}>
          <ul className="grid grid-cols-3 justify-items-center gap-2">
            {summary.latest.map((a) => (
              <li key={a.id}>
                <Sticker
                  id={a.id}
                  icon={a.icon}
                  name={a.name}
                  number={a.number}
                  rarity={a.rarity}
                  earned
                  size="sm"
                  caption={shortDateLabel(a.unlockedAt) || ''}
                  onClick={() => onOpen(a.id)}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Lo que viene" description={isMe ? 'Las láminas que tienes más cerca.' : `Las que ${owner?.name} tiene más cerca.`}>
          <Surface padding="none" className="divide-y divide-line overflow-hidden">
            {upcoming.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen(a.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-sunk"
              >
                <Sticker id={a.id} number={a.number} name={a.name} earned={false} size={56} showLabel={false} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="type-body truncate font-semibold text-ink">{a.name}</span>
                    <span className="type-caption shrink-0 tabular-nums text-ink-soft">{formatProgress(a)}</span>
                  </span>
                  <ProgressBar value={a.progress.current} max={a.progress.target} userId={memberId} size="sm" className="mt-2" />
                </span>
              </button>
            ))}
          </Surface>
        </Section>
      )}

      <div className="mt-10">
        <h2 className="sr-only">Páginas del álbum</h2>
        {summary.pages.map((page, i) => (
          <AlbumSpread key={page.id} page={page} index={i} highlight={highlight} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

/** Una página del álbum: título, cuántas lleva, y las láminas en su orden. */
function AlbumSpread({ page, index, highlight, onOpen }) {
  const complete = page.total > 0 && page.earned === page.total
  const headingId = `pagina-${page.id}`
  return (
    <section aria-labelledby={headingId} className="mt-5 first:mt-0">
      <div className="rounded-surface border border-line bg-surface px-3 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h3 id={headingId} className="type-heading text-ink">
              {page.title}
            </h3>
            <p className="type-small mt-0.5 text-ink-soft">{page.description}</p>
          </div>
          <p
            className={cx(
              'type-small mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold tabular-nums',
              complete ? 'bg-done-soft text-done-ink' : 'bg-surface-sunk text-ink-soft'
            )}
          >
            {complete && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            {page.earned} de {page.total}
            <span className="sr-only">{complete ? ', página completa' : ' láminas'}</span>
          </p>
        </div>

        <ul className="mt-6 grid grid-cols-3 justify-items-center gap-x-1 gap-y-5">
          {page.items.map((a) => (
            <li key={a.id} id={`lamina-${a.id}`}>
              <Sticker
                id={a.id}
                icon={a.icon}
                name={a.name}
                number={a.number}
                rarity={a.rarity}
                earned={a.earned}
                justEarned={a.earned && highlight.includes(a.id)}
                size="sm"
                caption={a.earned ? '' : (a.progress?.current > 0 && formatProgress(a, { short: true })) || undefined}
                onClick={() => onOpen(a.id)}
              />
            </li>
          ))}
        </ul>
        <p aria-hidden="true" className="type-caption mt-4 text-center tabular-nums text-ink-faint">
          {index + 1}
        </p>
      </div>
    </section>
  )
}

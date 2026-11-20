import { useId } from 'react'
import { cx, hashString } from './cx'

/**
 * Sticker — una lámina del álbum. Lo más memorable de la app: troquelada con borde blanco,
 * sombra dura, levemente rotada (siempre igual para la misma lámina), y las legendarias con
 * brillo holográfico. Sin ganar, es el hueco punteado con su número.
 *
 *   <Sticker id="streak_4" icon="🔥" name="Cuatro seguidas" number={12} rarity="rara" earned />
 *   <Sticker id="first_workout" number={1} name="Primera sesión" earned={false} caption="0 de 1" />
 *   <Sticker id="family_4x" icon="🏆" name="Familia imparable" number={58} rarity="legendaria"
 *            earned justEarned size="lg" />                          // animación de "pegar"
 *   <Sticker … onClick={() => openDetail(id)} />                       // se vuelve botón
 *
 * @param {string} id           id del logro; define la forma y la rotación (deterministas)
 * @param {string} [icon]       emoji/glifo de la lámina (contenido)
 * @param {string} [name]       nombre bajo la lámina
 * @param {number} [number]     número en el álbum
 * @param {'comun'|'rara'|'epica'|'legendaria'} [rarity='comun']
 * @param {boolean} [earned=false]
 * @param {'sm'|'md'|'lg'|number} [size='md'] 72 / 104 / 152 px (lado de la lámina)
 * @param {'circle'|'rounded'|'scallop'|'hexagon'} [shape] forzar forma (por defecto, derivada del id)
 * @param {React.ReactNode} [caption] línea bajo el nombre (por defecto la rareza si está ganada;
 *                                    pasa el progreso para las no ganadas, p. ej. "3 de 4 semanas")
 * @param {boolean} [showLabel=true] muestra nombre/caption
 * @param {boolean} [justEarned]     reproduce la animación de pegado al montar
 * @param {()=>void} [onClick]
 */
export const STICKER_SIZES = { sm: 72, md: 104, lg: 152 }
export const RARITIES = ['comun', 'rara', 'epica', 'legendaria']
export const RARITY_LABEL = { comun: 'Común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' }
const SHAPES = ['circle', 'rounded', 'scallop', 'hexagon']

function scallopPath(cx, cy, r, bumps, depth) {
  const steps = bumps * 12
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const rr = r + depth * Math.cos(bumps * t)
    const x = cx + rr * Math.cos(t)
    const y = cy + rr * Math.sin(t)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d + 'Z'
}

function hexPath(cx, cy, r) {
  let d = ''
  for (let i = 0; i < 6; i++) {
    const t = (Math.PI / 3) * i + Math.PI / 6
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`
  }
  return d + 'Z'
}

function roundedPath(x, y, w, h, r) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
}

const PATHS = {
  circle: 'M60 13a47 47 0 1 1 0 94a47 47 0 1 1 0-94Z',
  rounded: roundedPath(15, 15, 90, 90, 26),
  scallop: scallopPath(60, 60, 45, 14, 3),
  hexagon: hexPath(60, 60, 50),
}

/** Forma y rotación deterministas de una lámina. */
export function stickerLook(id = '') {
  const h = hashString(String(id))
  return { shape: SHAPES[h % SHAPES.length], rotation: ((h >>> 4) % 9) - 4 }
}

function Rays({ count = 16 }) {
  // Rayos impresos dentro de la lámina (tinta plana de imprenta, no un degradado)
  const rays = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const a2 = a + Math.PI / count
    rays.push(
      `M60 60L${(60 + 90 * Math.cos(a)).toFixed(1)} ${(60 + 90 * Math.sin(a)).toFixed(1)}L${(60 + 90 * Math.cos(a2)).toFixed(1)} ${(60 + 90 * Math.sin(a2)).toFixed(1)}Z`
    )
  }
  return <path d={rays.join('')} className="sticker-print" />
}

// Puntos de imprenta (semitono) para las comunes: textura de papel impreso.
const HALFTONE = (() => {
  let d = ''
  for (let y = 4, row = 0; y < 120; y += 7, row++) {
    for (let x = row % 2 ? 7.5 : 4, col = 0; x < 120; x += 7, col++) {
      const r = 0.9 + 0.9 * (1 - Math.hypot(x - 60, y - 60) / 85)
      if (r > 0.35) d += `M${(x - r).toFixed(2)} ${y}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`
    }
  }
  return d
})()

// Brillo de lámina plastificada: una media luna blanca plana arriba a la izquierda.
const GLOSS = 'M20 46C22 30 33 19 50 15C38 23 30 33 27 47C25 52 19 52 20 46Z'
// Destellos de la legendaria
const SPARKS = 'M26 30l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6zM95 76l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9zM88 22l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z'

export default function Sticker({
  id = '',
  icon,
  name,
  number,
  rarity = 'comun',
  earned = false,
  size = 'md',
  shape: shapeProp,
  caption,
  showLabel = true,
  justEarned = false,
  onClick,
  className,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const px = typeof size === 'number' ? size : STICKER_SIZES[size] || STICKER_SIZES.md
  const look = stickerLook(id)
  const shape = PATHS[shapeProp] ? shapeProp : look.shape
  const d = PATHS[shape]
  const rar = RARITIES.includes(rarity) ? rarity : 'comun'
  const holo = earned && rar === 'legendaria'
  const clipId = `stk-clip-${uid}`
  const foilId = `stk-foil-${uid}`
  const sheenId = `stk-sheen-${uid}`
  const cutId = `stk-cut-${uid}`
  const captionText = caption ?? (earned ? RARITY_LABEL[rar] : null)
  const a11y = earned
    ? `Lámina ${number ?? ''} ${name ?? ''}, ${RARITY_LABEL[rar].toLowerCase()}, ganada`
    : `Lámina ${number ?? ''} ${name ?? ''}, por ganar${typeof caption === 'string' ? `: ${caption}` : ''}`

  const art = earned ? (
    <span
      className={cx('sticker', `sticker-${rar}`, justEarned && 'animate-stick', onClick && 'group')}
      data-interactive={onClick ? 'true' : undefined}
      style={{ '--rot': `${look.rotation}deg`, width: px, height: px }}
    >
      <svg viewBox="0 0 120 120" width={px} height={px} aria-hidden="true" className="block overflow-visible">
        <defs>
          <clipPath id={clipId}>
            <path d={d} />
          </clipPath>
          {/* el glifo también va troquelado: contorno blanco alrededor del emoji */}
          <filter id={cutId} x="-25%" y="-25%" width="150%" height="150%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="grow" />
            <feFlood floodColor="#ffffff" />
            <feComposite in2="grow" operator="in" result="cut" />
            <feDropShadow in="cut" dx="0.6" dy="1.2" stdDeviation="0.6" floodColor="#16203a" floodOpacity="0.22" result="cutShadow" />
            <feMerge>
              <feMergeNode in="cutShadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {holo && (
            <>
              <linearGradient id={foilId} x1="0" y1="0" x2="0.42" y2="0.42" spreadMethod="reflect">
                <stop offset="0" stopColor="#ff4fa3" />
                <stop offset="0.2" stopColor="#ffd23a" />
                <stop offset="0.4" stopColor="#3fe0a2" />
                <stop offset="0.6" stopColor="#38b2ff" />
                <stop offset="0.8" stopColor="#9a66ff" />
                <stop offset="1" stopColor="#ff4fa3" />
              </linearGradient>
              <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0.38" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="0.62" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </>
          )}
        </defs>
        {/* troquel: el borde blanco que sobresale de la lámina */}
        <path d={d} className="sticker-edge" strokeWidth="13" />
        <g clipPath={`url(#${clipId})`} style={{ isolation: 'isolate' }} data-rarity={rar}>
          <rect width="120" height="120" className="sticker-fill" />
          {rar === 'comun' ? (
            <path d={HALFTONE} className="sticker-print" />
          ) : (
            <Rays count={rar === 'legendaria' ? 20 : rar === 'epica' ? 24 : 16} />
          )}
          {holo && (
            <>
              <rect className="sticker-holo" x="-40" y="-40" width="200" height="200" fill={`url(#${foilId})`} />
              <rect className="sticker-sheen" x="-60" y="-20" width="240" height="160" fill={`url(#${sheenId})`} />
            </>
          )}
          {/* marco impreso interior */}
          <path d={d} className="sticker-frame" transform="translate(60 60) scale(0.84) translate(-60 -60)" />
          <path d={GLOSS} fill="#ffffff" opacity="0.4" />
          {holo && <path d={SPARKS} className="sticker-sparks" fill="#ffffff" />}
        </g>
        <path d={d} fill="none" stroke="rgb(22 32 58 / 0.12)" strokeWidth="1" />
        <text
          x="60"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="48"
          filter={`url(#${cutId})`}
          style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
        >
          {icon || '⭐'}
        </text>
        {number != null && (
          <g>
            <circle cx="98" cy="98" r="14" fill="var(--sticker-edge)" />
            <circle cx="98" cy="98" r="14" fill="none" stroke="rgb(22 32 58 / 0.14)" strokeWidth="1" />
            <text
              x="98"
              y="98.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={number > 99 ? 10 : 12.5}
              fontWeight="800"
              fill="#16203a"
              style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}
            >
              {number}
            </text>
          </g>
        )}
      </svg>
    </span>
  ) : (
    <span className="relative inline-block" style={{ width: px, height: px }}>
      <svg viewBox="0 0 120 120" width={px} height={px} aria-hidden="true" className="block">
        <path d={d} className="sticker-slot" vectorEffect="non-scaling-stroke" />
        {number != null && (
          <text
            x="60"
            y="61"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={number > 99 ? 28 : 34}
            fontWeight="800"
            fill="var(--ink-faint)"
            letterSpacing="-1"
            style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}
          >
            {number}
          </text>
        )}
      </svg>
    </span>
  )

  const label = showLabel && (name || captionText) && (
    <span className="mt-2.5 flex flex-col items-center text-center" style={{ maxWidth: Math.max(px + 16, 96) }}>
      {name && (
        <span className={cx('type-small line-clamp-2 font-semibold leading-tight', earned ? 'text-ink' : 'text-ink-soft')}>
          {name}
        </span>
      )}
      {captionText && (
        <span
          className="type-caption mt-0.5 tabular-nums"
          style={{ color: earned && caption == null ? `var(--rar-${rar}-ink)` : 'var(--ink-soft)' }}
        >
          {captionText}
        </span>
      )}
    </span>
  )

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      role={onClick ? undefined : 'img'}
      aria-label={a11y.replace(/\s+/g, ' ').trim()}
      className={cx('inline-flex flex-col items-center rounded-surface', onClick && 'p-1', className)}
    >
      {art}
      {label && <span aria-hidden="true">{label}</span>}
    </Tag>
  )
}

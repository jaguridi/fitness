import { cx } from './cx'
import { memberProps } from './member'

/**
 * Avatar — imagen (ruta que empieza con '/') o emoji, en un círculo con el tinte
 * de la persona. No sabe de ánimos: si quieres el avatar "feliz", pásale esa ruta.
 *
 *   <Avatar userId="user1" src="/avatars/jose.png" name="Jose" size="md" />
 *   <Avatar userId="user2" src="🧘‍♀️" name="Javi" size={40} />
 *
 * Los avatares de imagen son pixel art de cuerpo entero: se encuadra la cabeza y
 * los hombros y se escala sin suavizado.
 *
 * @param {string} src     ruta de imagen o emoji
 * @param {string} name    texto alternativo
 * @param {string} [userId] para el tinte de fondo (data-member)
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} [size='md'] 28 / 36 / 48 / 64 / 88 px o px exactos
 * @param {boolean} [plain] sin fondo (p. ej. dentro de un AvatarRing que ya lo pone)
 */
export const AVATAR_SIZES = { xs: 28, sm: 36, md: 48, lg: 64, xl: 88 }

const BASE = import.meta.env.BASE_URL || '/'

export function avatarSrc(src) {
  if (!src || !src.startsWith('/')) return null
  return `${BASE}${src.slice(1)}`
}

export default function Avatar({ src, name = '', userId, size = 'md', plain = false, className, style }) {
  const px = typeof size === 'number' ? size : AVATAR_SIZES[size] || AVATAR_SIZES.md
  const img = avatarSrc(src)
  return (
    <span
      {...memberProps(userId)}
      role="img"
      aria-label={name || undefined}
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        !plain && 'bg-member-tint',
        className
      )}
      style={{ width: px, height: px, ...style }}
    >
      {img ? (
        <img
          src={img}
          alt=""
          draggable="false"
          className="absolute left-1/2 top-[6%] w-[150%] max-w-none -translate-x-1/2 select-none"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span aria-hidden="true" className="leading-none select-none" style={{ fontSize: Math.round(px * 0.56) }}>
          {src || '🙂'}
        </span>
      )}
    </span>
  )
}

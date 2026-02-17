const BASE_PATH = import.meta.env.BASE_URL || '/'

/**
 * Avatar component that renders either an image or an emoji.
 * If `src` starts with '/' it's treated as an image path, otherwise as emoji text.
 * Optionally shows a shield overlay when the user has an active shield.
 *
 * @param {string} src - Image path (e.g. '/avatars/jose.png') or emoji (e.g. '🏃‍♂️')
 * @param {string} name - Alt text for the image
 * @param {string} size - Tailwind size: 'sm' (32px), 'md' (48px), 'lg' (64px), 'xl' (80px)
 * @param {boolean} hasShield - Whether to show a shield badge on the avatar
 */
export default function Avatar({ src, name = '', size = 'md', hasShield = false }) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-2xl', img: 'w-8 h-8', shield: 'text-xs -bottom-1 -right-1' },
    md: { container: 'w-12 h-12', text: 'text-4xl', img: 'w-12 h-12', shield: 'text-sm -bottom-1 -right-1' },
    lg: { container: 'w-16 h-16', text: 'text-5xl', img: 'w-16 h-16', shield: 'text-base -bottom-1 -right-1' },
    xl: { container: 'w-20 h-20', text: 'text-6xl', img: 'w-20 h-20', shield: 'text-lg -bottom-1 -right-1' },
  }

  const s = sizes[size] || sizes.md
  const isImage = src && src.startsWith('/')

  const shieldBadge = hasShield ? (
    <span className={`absolute ${s.shield} drop-shadow-lg`}>🛡️</span>
  ) : null

  if (isImage) {
    const fullPath = `${BASE_PATH}${src.startsWith('/') ? src.slice(1) : src}`
    return (
      <div className={`relative ${s.container} flex-shrink-0`}>
        <img
          src={fullPath}
          alt={name}
          className={`${s.img} object-contain`}
        />
        {shieldBadge}
      </div>
    )
  }

  return (
    <div className={`relative ${s.container} flex items-center justify-center flex-shrink-0`}>
      <span className={s.text}>{src || '🏃'}</span>
      {shieldBadge}
    </div>
  )
}

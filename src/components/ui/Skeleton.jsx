import { cx } from './cx'

/**
 * Skeleton — bloque de carga que respira. Imita la forma real de lo que viene.
 *
 *   <Skeleton className="h-8 w-2/3" />                 // un titular
 *   <Skeleton shape="circle" className="size-14" />    // un avatar
 *   <Skeleton shape="surface" className="h-40" />      // una tarjeta de feed
 *   <SkeletonText lines={3} />
 *
 * @param {'line'|'circle'|'surface'} [shape='line']
 */
export default function Skeleton({ shape = 'line', className }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'block animate-skeleton bg-surface-sunk',
        shape === 'circle' ? 'rounded-full' : shape === 'surface' ? 'rounded-surface' : 'h-4 rounded-md',
        className
      )}
    />
  )
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <span aria-hidden="true" className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-3/5' : 'w-full'} />
      ))}
    </span>
  )
}

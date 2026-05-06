/**
 * Reusable skeleton loader components for loading states.
 * Replaces bouncing emojis with smooth pulsing placeholders.
 */

function Pulse({ className = '' }) {
  return <div className={`animate-pulse bg-gray-700 rounded-xl ${className}`} />
}

/** Skeleton for a single UserCard on the Dashboard */
export function UserCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
      <div className="flex items-center gap-3">
        <Pulse className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-24" />
          <Pulse className="h-3 w-16" />
        </div>
        <Pulse className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Pulse className="h-3 w-28" />
          <Pulse className="h-3 w-10" />
        </div>
        <Pulse className="h-3 w-full rounded-full" />
      </div>
      <div className="flex justify-between">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-3 w-16" />
      </div>
    </div>
  )
}

/** Skeleton for a Feed workout card */
export function FeedCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
      <div className="flex items-center gap-3 p-3">
        <Pulse className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Pulse className="h-3.5 w-20" />
          <Pulse className="h-2.5 w-14" />
        </div>
        <Pulse className="h-5 w-16 rounded-full" />
      </div>
      <Pulse className="w-full h-48 rounded-none" />
      <div className="p-3 space-y-2">
        <div className="flex gap-3">
          <Pulse className="h-3 w-16" />
          <Pulse className="h-3 w-20" />
        </div>
        <Pulse className="h-3 w-3/4" />
      </div>
      <div className="px-3 pb-2 flex gap-1.5">
        {[...Array(5)].map((_, i) => (
          <Pulse key={i} className="h-7 w-10 rounded-full" />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the Stats page */
export function StatsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Leaderboard skeleton */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <Pulse className="h-4 w-40" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? 'border-b border-gray-700/50' : ''}`}>
            <Pulse className="w-5 h-5 rounded" />
            <Pulse className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-3.5 w-16" />
              <Pulse className="h-1.5 w-full rounded-full" />
            </div>
            <Pulse className="h-3 w-14" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="grid grid-cols-4 border-b border-gray-700">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="py-2.5 flex flex-col items-center gap-1">
              <Pulse className="w-8 h-8 rounded-full" />
              <Pulse className="h-2.5 w-10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-700">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-700/50 rounded-xl p-2.5 space-y-1.5">
              <Pulse className="h-5 w-10 mx-auto" />
              <Pulse className="h-2.5 w-14 mx-auto" />
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="flex items-end justify-between gap-1 h-24">
            {[...Array(8)].map((_, i) => (
              <Pulse key={i} className="flex-1 rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Skeleton for the Dashboard (4 user cards + pot) */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Pot skeleton */}
      <Pulse className="h-20 w-full" />
      {/* User card skeletons */}
      {[...Array(4)].map((_, i) => (
        <UserCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton for UserDetail page */
export function UserDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-center space-y-3">
        <Pulse className="w-20 h-20 rounded-full mx-auto" />
        <Pulse className="h-6 w-28 mx-auto" />
        <Pulse className="h-4 w-36 mx-auto" />
      </div>
      {[...Array(3)].map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  )
}

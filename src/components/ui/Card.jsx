/** Base dark card used across the app. Extra classes (padding, hover…) via className. */
export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-gray-800 rounded-2xl border border-gray-700 ${className}`} {...props}>
      {children}
    </div>
  )
}

/** Card with a bordered title header; `aside` renders on the right (filters, buttons). */
export function SectionCard({ title, subtitle, aside, className = '', children }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-white text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  )
}

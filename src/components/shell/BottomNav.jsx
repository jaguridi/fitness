import { NavLink, useLocation } from 'react-router-dom'
import { CircleUser, House, Plus, Sticker, Users } from 'lucide-react'
import { cx } from '../ui/cx'
import { memberProps } from '../ui/member'

/**
 * Barra inferior: Hoy · Familia · (+) · Logros · Perfil.
 * El + abre la hoja de registrar ejercicio. La pestaña activa lleva una marca en el
 * color de quien usa la app.
 */
const TABS = [
  { to: '/', label: 'Hoy', icon: House, match: (p) => p === '/' || p.startsWith('/habitos') || p.startsWith('/metas') },
  { to: '/familia', label: 'Familia', icon: Users, match: (p) => p.startsWith('/familia') || p.startsWith('/u/') },
  null,
  { to: '/logros', label: 'Logros', icon: Sticker, match: (p) => p.startsWith('/logros') },
  {
    to: '/perfil',
    label: 'Perfil',
    icon: CircleUser,
    match: (p) => ['/perfil', '/stats', '/archivo', '/novedades'].some((x) => p.startsWith(x)),
  },
]

export default function BottomNav({ userId, onLog }) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Principal"
      {...memberProps(userId)}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-safe backdrop-blur-md backdrop-saturate-150"
    >
      <ul className="mx-auto grid h-[4.5rem] max-w-md grid-cols-5 px-1">
        {TABS.map((tab, i) => {
          if (!tab) {
            return (
              <li key="log" className="flex items-start justify-center">
                <button
                  type="button"
                  onClick={onLog}
                  aria-label="Registrar ejercicio"
                  className="-mt-5 inline-flex size-[3.75rem] items-center justify-center rounded-[22px] bg-ink text-on-ink shadow-fab ring-4 ring-paper transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95"
                >
                  <Plus size={28} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </li>
            )
          }
          const active = tab.match(pathname)
          const Icon = tab.icon
          return (
            <li key={tab.to} className="relative">
              <NavLink
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex h-full flex-col items-center justify-center gap-1 rounded-control text-xs transition-colors duration-150',
                  active ? 'font-bold text-ink' : 'font-medium text-ink-soft hover:text-ink'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-member transition-opacity duration-200',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon size={23} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                {tab.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

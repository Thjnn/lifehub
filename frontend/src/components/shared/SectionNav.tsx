import { NavLink, useLocation } from 'react-router'
import { navItems } from '@/lib/nav'
import { cn } from '@/lib/utils'

// Sub-page tabs for sections that have children (Finance, Settings). Same on desktop and mobile.
export function SectionNav() {
  const { pathname } = useLocation()
  const section = navItems.find((item) => item.children && pathname.startsWith(item.to))
  if (!section?.children) return null

  return (
    <nav aria-label={section.label} className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div className="flex w-max gap-1 rounded-xl border bg-card p-1">
        {section.children.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

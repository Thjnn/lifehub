import { useState } from 'react'
import { Download, Ellipsis } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { IosInstallSheet } from '@/components/shared/IosInstallSheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { bottomNavItems, moreNavItems } from '@/lib/nav'
import { cn } from '@/lib/utils'

const itemClass = 'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors'

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const installer = useInstallPrompt()
  const { pathname } = useLocation()
  const moreActive = moreNavItems.some((item) => pathname.startsWith(item.to))

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {bottomNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(itemClass, isActive ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(itemClass, moreActive ? 'text-primary' : 'text-muted-foreground')}
        >
          <Ellipsis className="size-5" aria-hidden />
          Thêm
        </button>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>Thêm</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-3 pb-4">
            {moreNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            ))}
            {(installer.canPrompt || installer.needsIosInstructions) && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  if (installer.canPrompt) installer.install()
                  else setIosHelpOpen(true)
                }}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-primary"
              >
                <Download className="size-5" aria-hidden />
                Cài đặt LIFEHUB
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <IosInstallSheet open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </nav>
  )
}

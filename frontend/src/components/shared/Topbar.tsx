import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, LogOut, Plus, Search, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { IosInstallSheet } from '@/components/shared/IosInstallSheet'
import { NetworkStatus } from '@/components/shared/NetworkStatus'
import { QuickCreate } from '@/components/shared/QuickCreate'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout, meQuery } from '@/features/auth/api'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { usePageTitle } from '@/hooks/use-page-title'

// "Nguyễn Văn Minh" → "VM"
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

export function Topbar() {
  const title = usePageTitle()
  const navigate = useNavigate()
  const { data: user } = useQuery(meQuery)
  const installer = useInstallPrompt()
  const [iosHelpOpen, setIosHelpOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
      <img src="/icons/logo.svg" alt="" className="size-7 lg:hidden" />
      <h1 className="truncate text-base font-semibold lg:text-lg">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => toast.info('Tìm kiếm nhanh sẽ có ở phase sau')}
          className="hidden h-9 w-56 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground md:flex"
        >
          <Search className="size-4" aria-hidden />
          Tìm nhanh…
        </button>
        <NetworkStatus />
        <QuickCreate
          trigger={
            <Button className="hidden lg:inline-flex">
              <Plus />
              Tạo mới
            </Button>
          }
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Tài khoản" className="rounded-full">
              <Avatar>
                <AvatarFallback>{user ? initials(user.name) : '…'}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <DropdownMenuLabel className="flex flex-col">
                  <span className="truncate text-foreground">{user.name}</span>
                  <span className="truncate font-normal text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link to="/app/settings/profile">
                <Settings />
                Cài đặt
              </Link>
            </DropdownMenuItem>
            {(installer.canPrompt || installer.needsIosInstructions) && (
              <DropdownMenuItem onSelect={installer.canPrompt ? installer.install : () => setIosHelpOpen(true)}>
                <Download />
                Cài đặt LIFEHUB
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <IosInstallSheet open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </header>
  )
}

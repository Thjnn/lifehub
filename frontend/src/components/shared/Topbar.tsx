import { LogOut, Plus, Search, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { NetworkStatus } from '@/components/shared/NetworkStatus'
import { QuickCreate } from '@/components/shared/QuickCreate'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePageTitle } from '@/hooks/use-page-title'

export function Topbar() {
  const title = usePageTitle()

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
                <AvatarFallback>LH</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link to="/app/settings/profile">
                <Settings />
                Cài đặt
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Logout wiring comes with auth in Phase 2 */}
            <DropdownMenuItem disabled>
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

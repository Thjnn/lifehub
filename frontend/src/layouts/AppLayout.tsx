import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Outlet } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { QuickCreate } from '@/components/shared/QuickCreate'
import { SectionNav } from '@/components/shared/SectionNav'
import { Sidebar } from '@/components/shared/Sidebar'
import { Topbar } from '@/components/shared/Topbar'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

export function AppLayout() {
  const title = usePageTitle()

  useEffect(() => {
    document.title = `${title} · LIFEHUB`
  }, [title])

  return (
    <div className="min-h-dvh lg:pl-62">
      <Sidebar />
      <Topbar />
      {/* Bottom padding keeps content clear of the mobile bottom nav + FAB */}
      <main className="mx-auto max-w-6xl p-4 pb-32 lg:p-8">
        <SectionNav />
        <Outlet />
      </main>
      <BottomNav />
      <QuickCreate
        trigger={
          <Button
            size="icon-lg"
            aria-label="Tạo nhanh"
            className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg lg:hidden"
          >
            <Plus className="size-6" />
          </Button>
        }
      />
    </div>
  )
}

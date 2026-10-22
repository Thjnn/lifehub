import { useState } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { discardItem, retryItem, syncOutbox, useOutbox } from '@/offline/outbox'
import { cn } from '@/lib/utils'

// Topbar badge for offline writes waiting to sync (spec §6.3). Failed ones are never dropped silently: the user decides.
export function SyncStatus() {
  const online = useOnlineStatus()
  const items = useOutbox()
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  const failed = items.filter((i) => i.status === 'failed').length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
          failed ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-warning/40 bg-warning/10 text-warning',
        )}
      >
        {failed ? <CircleAlert className="size-3.5" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        {failed ? `${failed} lỗi đồng bộ` : `${items.length} chưa đồng bộ`}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>Thay đổi chưa đồng bộ</SheetTitle>
            <SheetDescription>
              {online ? 'Đang gửi lên máy chủ theo thứ tự.' : 'Bạn đang offline — sẽ tự gửi khi có mạng.'}
            </SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col divide-y px-4 pb-4">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={cn('text-xs', item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
                  {item.status === 'failed' ? item.error : 'Đang chờ gửi'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {item.status === 'failed' && (
                    <Button size="sm" variant="outline" disabled={!online} onClick={() => retryItem(item)}>
                      Thử lại
                    </Button>
                  )}
                  {item.conflict && (
                    <Button size="sm" variant="outline" disabled={!online} onClick={() => retryItem(item, { overwrite: true })}>
                      Ghi đè bản trên máy chủ
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => discardItem(item)}>
                    Bỏ thay đổi này
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {online && (
            <div className="px-4 pb-4">
              <Button className="w-full" variant="outline" onClick={() => syncOutbox()}>
                <RefreshCw />
                Đồng bộ ngay
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

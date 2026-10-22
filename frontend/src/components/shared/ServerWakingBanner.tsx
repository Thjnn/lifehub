import { useSyncExternalStore } from 'react'
import { Loader2 } from 'lucide-react'
import { serverWaking } from '@/lib/api-client'

export function ServerWakingBanner() {
  const waking = useSyncExternalStore(serverWaking.subscribe, serverWaking.get)
  if (!waking) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg"
    >
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
      <span>
        Đang đánh thức máy chủ…
        <span className="block text-muted-foreground">Lần đầu có thể mất 30–60 giây.</span>
      </span>
    </div>
  )
}

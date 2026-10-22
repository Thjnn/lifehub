import { useQueryClient } from '@tanstack/react-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDataTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export function NetworkStatus() {
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  // Newest successful fetch among cached queries = how fresh the data on screen is (spec §6.2).
  const lastUpdated = online
    ? 0
    : Math.max(0, ...queryClient.getQueryCache().getAll().map((query) => query.state.dataUpdatedAt))

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        online ? 'text-muted-foreground' : 'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      <span className={cn('size-2 rounded-full', online ? 'bg-success' : 'bg-warning')} aria-hidden />
      {online ? 'Online' : 'Offline'}
      {lastUpdated > 0 && (
        <span>
          · <span className="hidden sm:inline">dữ liệu lúc </span>
          {formatDataTime(lastUpdated)}
        </span>
      )}
    </span>
  )
}

import { useOnlineStatus } from '@/hooks/use-online-status'
import { cn } from '@/lib/utils'

export function NetworkStatus() {
  const online = useOnlineStatus()

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        online ? 'text-muted-foreground' : 'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      <span className={cn('size-2 rounded-full', online ? 'bg-success' : 'bg-warning')} aria-hidden />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

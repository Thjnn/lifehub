import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AiText } from '@/features/ai/AiText'
import { briefingQuery, useRefreshBriefing } from '@/features/ai/api'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDataTime } from '@/lib/format'

// Daily briefing (spec §9.1/§9.5): generated once per day by the backend, cached; refresh is rate-limited.
export function BriefingCard() {
  const online = useOnlineStatus()
  const briefing = useQuery(briefingQuery)
  const refresh = useRefreshBriefing()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Tóm tắt hôm nay
        </h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Làm mới tóm tắt"
          disabled={!online || refresh.isPending}
          onClick={() => refresh.mutate(undefined, { onError: (e) => toast.error(e.message) })}
        >
          <RefreshCw className={refresh.isPending ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {briefing.isPending ? (
        <div className="flex flex-col gap-2" aria-label="AI đang soạn tóm tắt">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : briefing.isError ? (
        <p className="text-sm text-muted-foreground">
          {online ? briefing.error.message : 'AI Coach cần có mạng.'}{' '}
          {online && (
            <button type="button" className="text-primary hover:underline" onClick={() => briefing.refetch()}>
              Thử lại
            </button>
          )}
        </p>
      ) : (
        <>
          <AiText text={briefing.data.content} />
          {briefing.data.generated_at && (
            <p className="text-xs text-muted-foreground">Tạo lúc {formatDataTime(new Date(briefing.data.generated_at).getTime())} bởi AI · có thể chưa chính xác</p>
          )}
        </>
      )}
    </section>
  )
}

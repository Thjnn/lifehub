import { CalendarPlus, Check, ListTodo, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDecideProposal, type Proposal } from '@/features/ai/api'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDue } from '@/lib/format'
import { cn } from '@/lib/utils'

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

// Preview of what the AI wants to add. Nothing is saved unless the user confirms (spec §9.5 step 7).
export function ProposalCard({ proposal, onDecided }: { proposal: Proposal; onDecided: (p: Proposal) => void }) {
  const online = useOnlineStatus()
  const decide = useDecideProposal()
  const { payload: p } = proposal
  const isTask = proposal.action_type === 'create_task'
  const settled = proposal.status !== 'pending'

  async function choose(decision: 'confirm' | 'reject') {
    try {
      await decide.mutateAsync({ id: proposal.id, decision })
      onDecided({ ...proposal, status: decision === 'confirm' ? 'confirmed' : 'rejected' })
      if (decision === 'confirm') toast.success(isTask ? 'Đã thêm công việc' : 'Đã thêm sự kiện')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xử lý được đề xuất')
    }
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border bg-card p-3', settled && 'opacity-70')}>
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {isTask ? <ListTodo className="size-3.5" aria-hidden /> : <CalendarPlus className="size-3.5" aria-hidden />}
        Đề xuất {isTask ? 'thêm công việc' : 'thêm sự kiện'}
      </p>
      <p className="text-sm font-medium">{p.title}</p>
      <p className="text-xs text-muted-foreground">
        {isTask
          ? [p.due_at ? `Hạn ${formatDue(p.due_at)}` : 'Không có hạn', p.priority && `ưu tiên ${p.priority}`].filter(Boolean).join(' · ')
          : `${formatDue(p.start_at!)}–${timeFormat.format(new Date(p.end_at!))}${p.location ? ` · ${p.location}` : ''}`}
      </p>
      {settled ? (
        <p className="text-xs">{proposal.status === 'confirmed' ? '✓ Đã thêm' : proposal.status === 'rejected' ? 'Đã bỏ qua' : 'Đã hết hạn'}</p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={!online || decide.isPending} onClick={() => choose('confirm')}>
            <Check />
            Xác nhận
          </Button>
          <Button size="sm" variant="ghost" disabled={!online || decide.isPending} onClick={() => choose('reject')}>
            <X />
            Bỏ qua
          </Button>
        </div>
      )}
    </div>
  )
}

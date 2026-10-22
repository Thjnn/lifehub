import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToggleTask, type Task } from '@/features/tasks/api'
import { isOverdue, priorityOption, statusLabel } from '@/features/tasks/labels'
import { formatDue } from '@/lib/format'
import { cn } from '@/lib/utils'

export function TaskItem({ task, onOpen, readOnly }: { task: Task; onOpen: () => void; readOnly: boolean }) {
  const toggle = useToggleTask()
  const done = task.status === 'completed'
  const overdue = isOverdue(task)
  const priority = priorityOption(task.priority)

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        className="mt-0.5 size-5"
        checked={done}
        disabled={readOnly || task.status === 'cancelled'}
        onCheckedChange={() => toggle.mutate(task)}
        aria-label={done ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`}
      />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left">
        <span className={cn('text-sm font-medium', (done || task.status === 'cancelled') && 'text-muted-foreground line-through')}>
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          {task.priority !== 'low' && (
            <Badge variant="outline" className={priority.className}>
              {priority.label}
            </Badge>
          )}
          {task.status === 'in_progress' || task.status === 'cancelled' ? (
            <Badge variant="outline">{statusLabel(task.status)}</Badge>
          ) : null}
          {task.due_at && (
            <span className={cn('inline-flex items-center gap-1', overdue ? 'text-destructive' : 'text-muted-foreground')}>
              <CalendarClock className="size-3.5" aria-hidden />
              {overdue && 'Quá hạn · '}
              {formatDue(task.due_at)}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

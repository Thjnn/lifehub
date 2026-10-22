import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import type { Budget } from '@/features/finance/api'
import { budgetStatus } from '@/features/finance/report-math'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/utils'

const statusStyle = {
  ok: { fill: 'bg-primary', text: 'text-muted-foreground', icon: CircleCheck },
  warning: { fill: 'bg-warning', text: 'text-warning', icon: TriangleAlert },
  over: { fill: 'bg-destructive', text: 'text-destructive', icon: CircleAlert },
}

// Meter: the fill carries severity; status is also given as icon + words, never colour alone.
export function BudgetMeter({ budget, label }: { budget: Budget; label: string }) {
  const status = budgetStatus(budget)
  const { fill, text, icon: Icon } = statusStyle[status]
  const over = budget.remaining.startsWith('-')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="tabular-nums whitespace-nowrap text-muted-foreground">
          {formatVnd(budget.spent)} / {formatVnd(budget.amount)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(budget.percent, 100)}
      >
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.min(budget.percent, 100)}%` }} />
      </div>
      <p className={cn('flex items-center gap-1 text-xs', text)}>
        <Icon className="size-3.5" aria-hidden />
        {over
          ? `Vượt ${formatVnd(budget.remaining.slice(1))} (${budget.percent}%)`
          : `Còn ${formatVnd(budget.remaining)} · đã dùng ${budget.percent}%`}
      </p>
    </div>
  )
}

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { percentChange } from '@/features/finance/report-math'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Stat tile: label · value · delta vs last month. The delta's colour = direction × whether up is good
 * (more income is good, more spending is bad); the arrow and sign carry the same meaning without colour.
 */
export function StatTile({
  label,
  value,
  previous,
  upIsGood,
  className,
}: {
  label: string
  value: string
  previous?: string
  upIsGood?: boolean
  className?: string
}) {
  const change = previous === undefined ? null : percentChange(value, previous)
  const good = change !== null && change !== 0 && (change > 0) === upIsGood
  const Arrow = change !== null && change < 0 ? ArrowDownRight : ArrowUpRight

  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border bg-card p-4', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{formatVnd(value)}</span>
      {previous !== undefined && (
        <span
          className={cn(
            'flex items-center gap-0.5 text-xs',
            change === null || change === 0 ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
          )}
        >
          {change === null ? (
            'Tháng trước chưa có dữ liệu'
          ) : (
            <>
              <Arrow className="size-3.5" aria-hidden />
              {change > 0 ? '+' : ''}
              {change}% so với tháng trước
            </>
          )}
        </span>
      )}
    </div>
  )
}

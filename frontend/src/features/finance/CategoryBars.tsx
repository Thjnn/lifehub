import type { Category, FinanceReport } from '@/features/finance/api'
import { CategoryIcon } from '@/features/finance/CategoryIcon'
import { formatVnd } from '@/lib/money'

/**
 * Spending by category as a ranked bar list (one hue — it is one measure, so no categorical palette).
 * Every value is printed beside its bar, so the list doubles as the table view.
 */
export function CategoryBars({ rows, categories, total }: { rows: FinanceReport['by_category']; categories: Category[]; total: string }) {
  const max = Math.max(...rows.map((r) => Number(r.amount)), 1)
  const totalNumber = Number(total) || 1

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const category = categories.find((c) => c.id === row.category_id)
        const share = Math.round((Number(row.amount) / totalNumber) * 100)
        return (
          <li key={row.category_id ?? 'none'} className="flex items-center gap-3">
            <CategoryIcon category={category} className="size-8" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{category?.name ?? 'Không phân loại'}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatVnd(row.amount)} <span className="text-xs text-muted-foreground">· {share}%</span>
                </span>
              </div>
              {/* ≤ 24px thick, 4px rounded data-end, square at the baseline */}
              <div className="h-2.5" aria-hidden>
                <div
                  className="h-full rounded-r-[4px] bg-primary"
                  style={{ width: `${Math.max((Number(row.amount) / max) * 100, 1)}%` }}
                />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

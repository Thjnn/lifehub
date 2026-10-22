import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PiggyBank, Plus, RotateCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { budgetsQuery, categoriesQuery, type Budget } from '@/features/finance/api'
import { BudgetFormSheet } from '@/features/finance/BudgetFormSheet'
import { BudgetMeter } from '@/features/finance/BudgetMeter'
import { MonthSwitcher } from '@/features/finance/MonthSwitcher'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { monthKey } from '@/lib/format'

export function BudgetsPage() {
  const online = useOnlineStatus()
  const [params, setParams] = useSearchParams()
  const [thisMonth] = useState(() => monthKey(new Date()))
  const month = params.get('month') ?? thisMonth

  const budgets = useQuery(budgetsQuery(month))
  const categories = useQuery(categoriesQuery)
  const [editing, setEditing] = useState<Budget>()
  const [creating, setCreating] = useState(false)

  const labelOf = (b: Budget) =>
    b.category_id === null ? 'Tổng chi tiêu' : (categories.data?.find((c) => c.id === b.category_id)?.name ?? 'Danh mục')

  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher
        month={month}
        max={thisMonth}
        onChange={(m) =>
          setParams((prev) => {
            prev.set('month', m)
            return prev
          })
        }
      />

      {budgets.isPending ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : budgets.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {online ? budgets.error.message : 'Bạn đang offline và chưa có dữ liệu lưu sẵn cho tháng này.'}
          {online && (
            <Button variant="outline" onClick={() => budgets.refetch()}>
              <RotateCw />
              Thử lại
            </Button>
          )}
        </div>
      ) : budgets.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <PiggyBank className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            Chưa có ngân sách cho tháng này. Đặt hạn mức cho tổng chi tiêu hoặc từng danh mục để được cảnh báo khi sắp vượt.
          </p>
          <Button variant="outline" disabled={!online} onClick={() => setCreating(true)}>
            <Plus />
            Đặt ngân sách
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {budgets.data.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => setEditing(b)} className="w-full p-4 text-left hover:bg-accent/40">
                  <BudgetMeter budget={b} label={labelOf(b)} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="self-start" disabled={!online} onClick={() => setCreating(true)}>
            <Plus />
            Thêm ngân sách
          </Button>
        </>
      )}

      <BudgetFormSheet
        open={creating || editing !== undefined}
        onOpenChange={(open) => {
          if (open) return
          setCreating(false)
          setEditing(undefined)
        }}
        month={month}
        budget={editing}
        budgets={budgets.data ?? []}
        categories={categories.data ?? []}
      />
    </div>
  )
}

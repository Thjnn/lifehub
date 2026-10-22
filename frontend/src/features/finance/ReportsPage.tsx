import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartNoAxesColumn, RotateCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { categoriesQuery, reportQuery } from '@/features/finance/api'
import { CategoryBars } from '@/features/finance/CategoryBars'
import { MonthSwitcher } from '@/features/finance/MonthSwitcher'
import { StatTile } from '@/features/finance/StatTile'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { monthKey } from '@/lib/format'

export function ReportsPage() {
  const online = useOnlineStatus()
  const [params, setParams] = useSearchParams()
  const [thisMonth] = useState(() => monthKey(new Date()))
  const month = params.get('month') ?? thisMonth
  const report = useQuery(reportQuery(month))
  const categories = useQuery(categoriesQuery)

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

      {report.isPending ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : report.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {/* Server-side reports are online-only (spec §6.2) unless this month was viewed before */}
          {online ? report.error.message : 'Báo cáo cần có mạng (trừ tháng bạn đã xem trước đó).'}
          {online && (
            <Button variant="outline" onClick={() => report.refetch()}>
              <RotateCw />
              Thử lại
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* KPI row; transfers are excluded from income and spending */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Tổng thu" value={report.data.income} previous={report.data.previous.income} upIsGood />
            <StatTile label="Tổng chi" value={report.data.expense} previous={report.data.previous.expense} upIsGood={false} />
            <StatTile label="Còn lại (thu − chi)" value={report.data.net} />
          </div>

          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Chi tiêu theo danh mục</h2>
            {report.data.by_category.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <ChartNoAxesColumn className="size-8" aria-hidden />
                Chưa có khoản chi nào trong tháng này.
              </div>
            ) : (
              <CategoryBars rows={report.data.by_category} categories={categories.data ?? []} total={report.data.expense} />
            )}
          </section>
        </>
      )}
    </div>
  )
}

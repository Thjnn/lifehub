import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { accountsQuery, budgetsQuery, categoriesQuery, debtsDueQuery, reportQuery, transactionsQuery } from '@/features/finance/api'
import { BudgetMeter } from '@/features/finance/BudgetMeter'
import { CategoryIcon } from '@/features/finance/CategoryIcon'
import { dueItemTitle, settleDefaults } from '@/features/finance/debts'
import { budgetStatus } from '@/features/finance/report-math'
import { StatTile } from '@/features/finance/StatTile'
import { TransactionFormSheet, type TransactionDefaults } from '@/features/finance/TransactionFormSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { dateKey, formatDayHeader, formatDue, fromDateKey, monthKey } from '@/lib/format'
import { formatVnd, sumMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

// /app/finance: balance, this month at a glance, budgets that need attention, latest activity.
export function FinanceOverviewPage() {
  const online = useOnlineStatus()
  const [month] = useState(() => monthKey(new Date()))
  // Unpaid repayments: anything overdue in the last month, plus the next two weeks.
  const [dueRange] = useState(() => {
    const today = new Date()
    return [dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 31)), dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14))]
  })
  const dues = useQuery(debtsDueQuery(dueRange[0], dueRange[1]))
  const [settling, setSettling] = useState<TransactionDefaults>()
  const accounts = useQuery(accountsQuery)
  const categories = useQuery(categoriesQuery)
  const report = useQuery(reportQuery(month))
  const budgets = useQuery(budgetsQuery(month))
  const recent = useInfiniteQuery(transactionsQuery({ month }))

  const balance = sumMoney((accounts.data ?? []).filter((a) => a.is_active).map((a) => a.balance))
  const attention = (budgets.data ?? []).filter((b) => budgetStatus(b) !== 'ok')
  const latest = recent.data?.pages[0]?.data.slice(0, 5) ?? []
  const category = (id: number | null) => categories.data?.find((c) => c.id === id)
  const unpaid = (dues.data ?? []).filter((d) => !d.paid)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.isPending ? <Skeleton className="h-24" /> : <StatTile label="Tổng số dư" value={balance} />}
        {report.isPending ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : report.isSuccess ? (
          <>
            <StatTile label="Thu tháng này" value={report.data.income} previous={report.data.previous.income} upIsGood />
            <StatTile label="Chi tháng này" value={report.data.expense} previous={report.data.previous.expense} upIsGood={false} />
            <StatTile label="Còn lại tháng này" value={report.data.net} />
          </>
        ) : null}
      </div>

      {unpaid.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <SectionHeader title="Sắp đến hạn trả" to="/app/finance/accounts" />
          <ul className="flex flex-col gap-3">
            {unpaid.map((d) => (
              <li key={`${d.account_id}-${d.due_date}`} className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{dueItemTitle(d)}</span>
                  <span className={cn('text-xs', d.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                    {d.overdue ? 'Quá hạn · ' : ''}
                    {formatDayHeader(fromDateKey(d.due_date))}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums">{formatVnd(d.amount)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online || !accounts.data}
                  onClick={() => {
                    const account = accounts.data?.find((a) => a.id === d.account_id)
                    if (account) setSettling(settleDefaults(account, d.amount, accounts.data ?? []))
                  }}
                >
                  {d.account_type === 'liability' ? 'Trả' : 'Thu'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <SectionHeader title="Ngân sách cần chú ý" to="/app/finance/budgets" />
          {budgets.isPending ? (
            <Skeleton className="h-12" />
          ) : attention.length > 0 ? (
            attention.map((b) => (
              <BudgetMeter key={b.id} budget={b} label={b.category_id === null ? 'Tổng chi tiêu' : (category(b.category_id)?.name ?? 'Danh mục')} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {budgets.data?.length ? 'Mọi ngân sách đều dưới 80%.' : 'Chưa đặt ngân sách cho tháng này.'}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <SectionHeader title="Giao dịch gần đây" to="/app/finance/transactions" />
          {recent.isPending ? (
            <Skeleton className="h-24" />
          ) : latest.length === 0 ? (
            <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
              Chưa có giao dịch trong tháng này.
              {online && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/app/finance/transactions?new=1">
                    <Plus />
                    Ghi giao dịch
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {latest.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <CategoryIcon category={category(t.category_id)} transfer={t.type === 'transfer'} className="size-8" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">
                      {t.description || (t.type === 'transfer' ? 'Chuyển khoản' : (category(t.category_id)?.name ?? 'Không phân loại'))}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDue(t.occurred_at)}</span>
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium whitespace-nowrap tabular-nums',
                      t.type === 'income' && 'text-success',
                      t.type === 'transfer' && 'text-muted-foreground',
                    )}
                  >
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                    {formatVnd(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <TransactionFormSheet open={settling !== undefined} onOpenChange={(open) => !open && setSettling(undefined)} defaults={settling} />
    </div>
  )
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Link to={to} className="flex items-center gap-1 text-xs text-primary hover:underline">
        Xem tất cả
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  )
}

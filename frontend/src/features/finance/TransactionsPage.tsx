import { useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, ReceiptText, RotateCw, WifiOff } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  accountsQuery,
  categoriesQuery,
  transactionsQuery,
  type Transaction,
  type TransactionFilters,
  type TransactionType,
} from '@/features/finance/api'
import { CategoryIcon } from '@/features/finance/CategoryIcon'
import { transactionTypeOptions } from '@/features/finance/labels'
import { TransactionFormSheet } from '@/features/finance/TransactionFormSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDayHeader, formatMonth, monthKey, shiftMonth } from '@/lib/format'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/utils'

const ALL = 'all'

export function TransactionsPage() {
  const online = useOnlineStatus()
  const [params, setParams] = useSearchParams()
  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      if (value === null || value === ALL) prev.delete(key)
      else prev.set(key, value)
      return prev
    })

  const [thisMonth] = useState(() => monthKey(new Date()))
  const month = params.get('month') ?? thisMonth
  const filters: TransactionFilters = {
    month,
    type: (params.get('type') ?? undefined) as TransactionType | undefined,
    account_id: params.get('account') ? Number(params.get('account')) : undefined,
    category_id: params.get('category') ? Number(params.get('category')) : undefined,
  }

  const accounts = useQuery(accountsQuery)
  const categories = useQuery(categoriesQuery)
  const query = useInfiniteQuery(transactionsQuery(filters))
  const transactions = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data])

  const accountName = (id: number | null) => accounts.data?.find((a) => a.id === id)?.name ?? '—'
  const category = (id: number | null) => categories.data?.find((c) => c.id === id)

  // Group by local day, newest first (the API already sorts by occurred_at desc).
  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const key = new Date(t.occurred_at).toDateString()
      byDay.set(key, [...(byDay.get(key) ?? []), t])
    }
    return [...byDay.entries()]
  }, [transactions])

  const [editing, setEditing] = useState<Transaction>()
  const creating = params.get('new') === '1'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Tháng trước" onClick={() => setParam('month', shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <span className="font-semibold">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tháng sau"
          disabled={month >= thisMonth}
          onClick={() => setParam('month', shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Loại"
          value={params.get('type') ?? ALL}
          options={[{ value: ALL, label: 'Mọi loại' }, ...transactionTypeOptions]}
          onChange={(v) => setParam('type', v)}
        />
        <FilterSelect
          label="Tài khoản"
          value={params.get('account') ?? ALL}
          options={[{ value: ALL, label: 'Mọi tài khoản' }, ...(accounts.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))]}
          onChange={(v) => setParam('account', v)}
        />
        <FilterSelect
          label="Danh mục"
          value={params.get('category') ?? ALL}
          options={[{ value: ALL, label: 'Mọi danh mục' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
          onChange={(v) => setParam('category', v)}
        />
        <Button className="ml-auto" disabled={!online} onClick={() => setParam('new', '1')}>
          <Plus />
          Thêm
        </Button>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Đang tải">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError && transactions.length === 0 ? (
        <Empty
          icon={online ? RotateCw : WifiOff}
          message={online ? query.error.message : 'Bạn đang offline và chưa có dữ liệu lưu sẵn cho tháng này.'}
          action={online ? <Button variant="outline" onClick={() => query.refetch()}>Thử lại</Button> : undefined}
        />
      ) : accounts.isSuccess && accounts.data.length === 0 ? (
        <Empty
          icon={ReceiptText}
          message="Bạn chưa có tài khoản nào. Tạo tài khoản (tiền mặt, ngân hàng, ví điện tử) để bắt đầu ghi giao dịch."
          action={
            <Button variant="outline" asChild>
              <Link to="/app/finance/accounts">Tạo tài khoản</Link>
            </Button>
          }
        />
      ) : transactions.length === 0 ? (
        <Empty
          icon={ReceiptText}
          message={`Chưa có giao dịch nào trong ${formatMonth(month).toLowerCase()}.`}
          action={
            online ? (
              <Button variant="outline" onClick={() => setParam('new', '1')}>
                <Plus />
                Ghi giao dịch
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([day, items]) => (
            <section key={day} className="rounded-xl border bg-card">
              <h3 className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">{formatDayHeader(new Date(day))}</h3>
              <ul className="divide-y">
                {items.map((t) => {
                  const c = category(t.category_id)
                  const title =
                    t.description || (t.type === 'transfer' ? 'Chuyển khoản' : (c?.name ?? 'Không phân loại'))
                  const subtitle =
                    t.type === 'transfer'
                      ? `${accountName(t.account_id)} → ${accountName(t.to_account_id)}`
                      : [t.description ? c?.name : null, accountName(t.account_id)].filter(Boolean).join(' · ')
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
                      >
                        <CategoryIcon category={c} transfer={t.type === 'transfer'} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{title}</span>
                          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                        </span>
                        <span
                          className={cn(
                            'text-sm font-semibold whitespace-nowrap tabular-nums',
                            t.type === 'income' && 'text-success',
                            t.type === 'transfer' && 'text-muted-foreground',
                          )}
                        >
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                          {formatVnd(t.amount)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {query.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={query.isFetchingNextPage || !online}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm'}
            </Button>
          )}
        </div>
      )}

      <TransactionFormSheet
        open={creating || editing !== undefined}
        onOpenChange={(open) => {
          if (open) return
          setEditing(undefined)
          if (creating) setParam('new', null)
        }}
        transaction={editing}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="max-w-44 data-[size=default]:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Empty({ icon: Icon, message, action }: { icon: typeof ReceiptText; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}

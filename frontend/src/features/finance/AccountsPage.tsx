import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RotateCw, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { accountsQuery, isDebtType, type Account } from '@/features/finance/api'
import { AccountFormSheet } from '@/features/finance/AccountFormSheet'
import { CategoryManager } from '@/features/finance/CategoryManager'
import { outstanding, settleDefaults } from '@/features/finance/debts'
import { AccountTypeIcon } from '@/features/finance/CategoryIcon'
import { accountTypeOptions } from '@/features/finance/labels'
import { TransactionFormSheet, type TransactionDefaults } from '@/features/finance/TransactionFormSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDue } from '@/lib/format'
import { formatVnd, sumMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export function AccountsPage() {
  const online = useOnlineStatus()
  const accounts = useQuery(accountsQuery)
  const [editing, setEditing] = useState<Account>()
  const [creating, setCreating] = useState(false)
  const [settling, setSettling] = useState<TransactionDefaults>()

  const all = accounts.data ?? []
  const active = all.filter((a) => a.is_active)
  const money = active.filter((a) => !isDebtType(a.account_type))
  const debts = active.filter((a) => isDebtType(a.account_type))
  const hidden = all.filter((a) => !a.is_active)
  // Net worth: money + what others owe me − what I owe (debt balances carry their sign).
  const netWorth = sumMoney(active.map((a) => a.balance))
  const owed = sumMoney(debts.filter((a) => a.account_type === 'liability').map((a) => a.balance))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">{debts.length > 0 ? 'Tài sản ròng (đã trừ nợ)' : 'Tổng số dư'}</p>
            {accounts.isPending ? (
              <Skeleton className="mt-1 h-8 w-40" />
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums">{formatVnd(netWorth)}</p>
                {owed !== '0.00' && (
                  <p className="text-xs text-muted-foreground">
                    Tiền đang có {formatVnd(sumMoney(money.map((a) => a.balance)))} · đang nợ {formatVnd(owed.replace('-', ''))}
                  </p>
                )}
              </>
            )}
          </div>
          <Button disabled={!online} onClick={() => setCreating(true)}>
            <Plus />
            Thêm
          </Button>
        </div>

        {accounts.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : accounts.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {accounts.error.message}
            {online && (
              <Button variant="outline" onClick={() => accounts.refetch()}>
                <RotateCw />
                Thử lại
              </Button>
            )}
          </div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
            <WalletCards className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-muted-foreground">
              Chưa có tài khoản. Thêm tiền mặt, ngân hàng, ví điện tử — hoặc khoản nợ / trả sau như SPayLater.
            </p>
          </div>
        ) : (
          <>
            <AccountGrid accounts={money} onOpen={setEditing} />
            {debts.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold">Nợ & cho vay</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {debts.map((d) => (
                    <DebtCard
                      key={d.id}
                      debt={d}
                      online={online}
                      onOpen={() => setEditing(d)}
                      onSettle={(amount) => setSettling(settleDefaults(d, amount, all))}
                    />
                  ))}
                </ul>
              </section>
            )}
            {hidden.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground">Đã ẩn ({hidden.length})</summary>
                <div className="mt-3">
                  <AccountGrid accounts={hidden} onOpen={setEditing} />
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <CategoryManager />

      <AccountFormSheet
        open={creating || editing !== undefined}
        onOpenChange={(open) => {
          if (open) return
          setCreating(false)
          setEditing(undefined)
        }}
        account={editing}
      />
      <TransactionFormSheet open={settling !== undefined} onOpenChange={(open) => !open && setSettling(undefined)} defaults={settling} />
    </div>
  )
}

function AccountGrid({ accounts, onOpen }: { accounts: Account[]; onOpen: (a: Account) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {accounts.map((a) => {
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent/40',
                !a.is_active && 'opacity-60',
              )}
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
                <AccountTypeIcon type={a.account_type} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">{accountTypeOptions.find((o) => o.value === a.account_type)?.label}</span>
              </span>
              <span className={cn('font-semibold tabular-nums', a.balance.startsWith('-') && 'text-destructive')}>
                {formatVnd(a.balance)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function scheduleText(debt: Account) {
  if (debt.due_day) {
    const each = debt.installment_amount ? ` · ${formatVnd(debt.installment_amount)}/kỳ` : ''
    return `Trả ngày ${debt.due_day} hằng tháng${each}`
  }
  if (debt.due_date) return `Hạn ${formatDue(`${debt.due_date}T00:00:00`).replace(/ 00:00$/, '')}`
  return 'Không có hạn'
}

function DebtCard({
  debt,
  online,
  onOpen,
  onSettle,
}: {
  debt: Account
  online: boolean
  onOpen: () => void
  onSettle: (amount: string) => void
}) {
  const left = outstanding(debt)
  const liability = debt.account_type === 'liability'
  const instalment = debt.installment_amount && left && Number(debt.installment_amount) < Number(left) ? debt.installment_amount : left

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <button type="button" onClick={onOpen} className="flex items-center gap-3 text-left">
        <span
          className={cn('grid size-10 place-items-center rounded-full', liability ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}
          aria-hidden
        >
          <AccountTypeIcon type={debt.account_type} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{debt.name}</span>
          <span className="text-xs text-muted-foreground">{scheduleText(debt)}</span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">
          {left ? (
            <>
              <span className="text-muted-foreground">{liability ? 'Đang nợ ' : 'Còn nợ bạn '}</span>
              <span className="font-semibold tabular-nums">{formatVnd(left)}</span>
            </>
          ) : (
            <span className="text-success">Đã trả hết</span>
          )}
        </span>
        {left && instalment && (
          <Button size="sm" variant="outline" disabled={!online} onClick={() => onSettle(instalment)}>
            {liability ? 'Trả nợ' : 'Thu nợ'}
          </Button>
        )}
      </div>
    </li>
  )
}

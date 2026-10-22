import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RotateCw, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { accountsQuery, type Account } from '@/features/finance/api'
import { AccountFormSheet } from '@/features/finance/AccountFormSheet'
import { CategoryManager } from '@/features/finance/CategoryManager'
import { accountTypeIcon, accountTypeOptions } from '@/features/finance/labels'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatVnd, sumMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export function AccountsPage() {
  const online = useOnlineStatus()
  const accounts = useQuery(accountsQuery)
  const [editing, setEditing] = useState<Account>()
  const [creating, setCreating] = useState(false)

  const active = accounts.data?.filter((a) => a.is_active) ?? []
  const hidden = accounts.data?.filter((a) => !a.is_active) ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">Tổng số dư (tài khoản đang dùng)</p>
            {accounts.isPending ? (
              <Skeleton className="mt-1 h-8 w-40" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{formatVnd(sumMoney(active.map((a) => a.balance)))}</p>
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
        ) : accounts.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
            <WalletCards className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-muted-foreground">
              Chưa có tài khoản. Thêm tiền mặt, tài khoản ngân hàng hoặc ví điện tử để theo dõi số dư.
            </p>
          </div>
        ) : (
          <>
            <AccountGrid accounts={active} onOpen={setEditing} />
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
    </div>
  )
}

function AccountGrid({ accounts, onOpen }: { accounts: Account[]; onOpen: (a: Account) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {accounts.map((a) => {
        const Icon = accountTypeIcon(a.account_type)
        const negative = a.balance.startsWith('-')
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
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  {accountTypeOptions.find((o) => o.value === a.account_type)?.label}
                </span>
              </span>
              <span className={cn('font-semibold tabular-nums', negative && 'text-destructive')}>{formatVnd(a.balance)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

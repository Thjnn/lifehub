import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, MoneyField, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDeleteBudget, useSaveBudget, type Budget, type Category } from '@/features/finance/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatMonth } from '@/lib/format'
import { ApiError } from '@/lib/api-client'

const OVERALL = 'overall'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: string
  budget?: Budget // undefined = create
  budgets: Budget[] // this month's, to hide categories that already have one
  categories: Category[]
}

export function BudgetFormSheet({ open, onOpenChange, ...props }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} className="pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{props.budget ? 'Sửa ngân sách' : `Ngân sách ${formatMonth(props.month).toLowerCase()}`}</SheetTitle>
        </SheetHeader>
        <BudgetForm key={props.budget?.id ?? 'new'} {...props} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function BudgetForm({ month, budget, budgets, categories, onDone }: Omit<Props, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const online = useOnlineStatus()
  const saveBudget = useSaveBudget()
  const deleteBudget = useDeleteBudget()
  const taken = new Set(budgets.map((b) => b.category_id ?? OVERALL))
  const options = [
    { value: OVERALL, label: 'Tổng chi tiêu (mọi danh mục)' },
    ...categories.filter((c) => c.type === 'expense').map((c) => ({ value: String(c.id), label: c.name })),
  ].filter((o) => !taken.has(o.value === OVERALL ? OVERALL : Number(o.value)))

  const [target, setTarget] = useState(options[0]?.value ?? OVERALL)
  const [amount, setAmount] = useState(budget ? budget.amount.split('.')[0] : '')
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[1-9]\d*$/.test(amount)) return setError('Nhập số tiền lớn hơn 0')
    try {
      await saveBudget.mutateAsync(
        budget
          ? { id: budget.id, input: { amount } }
          : { input: { month, category_id: target === OVERALL ? null : Number(target), amount } },
      )
      toast.success('Đã lưu ngân sách')
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.errors)[0]?.[0] ?? err.message) : 'Không lưu được')
    }
  }

  async function remove() {
    try {
      await deleteBudget.mutateAsync(budget!.id)
      toast.success('Đã xoá ngân sách')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xoá được')
    }
  }

  if (!budget && options.length === 0) {
    return <p className="px-4 pb-6 text-sm text-muted-foreground">Mọi danh mục đã có ngân sách trong tháng này.</p>
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && <FormError message="Bạn đang offline. Cần có mạng để lưu." />}
      <FormError message={error} />
      {!budget && <SelectField label="Áp dụng cho" value={target} onChange={setTarget} options={options} />}
      <MoneyField label="Hạn mức" value={amount} onChange={setAmount} autoFocus />
      <Button type="submit" size="lg" disabled={!online || saveBudget.isPending}>
        Lưu
      </Button>
      {budget && (
        <Button type="button" variant="destructive" size="lg" disabled={!online || deleteBudget.isPending} onClick={remove}>
          <Trash2 />
          Xoá ngân sách
        </Button>
      )}
    </form>
  )
}

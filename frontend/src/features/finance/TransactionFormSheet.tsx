import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, MoneyField, SelectField, SubmitButton, TextField } from '@/components/shared/form-fields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  accountsQuery,
  categoriesQuery,
  useDeleteTransaction,
  useSaveTransaction,
  type Account,
  type Category,
  type Transaction,
  type TransactionType,
} from '@/features/finance/api'
import { transactionTypeOptions } from '@/features/finance/labels'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { applyServerErrors, zodResolver } from '@/lib/form'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/utils'

const NO_CATEGORY = 'none' // Radix Select can't use "" as a value

const schema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.string().regex(/^[1-9]\d*$/, 'Nhập số tiền lớn hơn 0').max(13, 'Số tiền quá lớn'),
    account_id: z.string().min(1, 'Chọn tài khoản'),
    to_account_id: z.string(),
    category_id: z.string(),
    occurred: z.string().min(1, 'Chọn thời gian'),
    description: z.string().max(1000, 'Tối đa 1000 ký tự'),
  })
  .refine((v) => v.type !== 'transfer' || v.to_account_id !== '', { path: ['to_account_id'], message: 'Chọn tài khoản nhận' })
  .refine((v) => v.type !== 'transfer' || v.to_account_id !== v.account_id, {
    path: ['to_account_id'],
    message: 'Tài khoản nhận phải khác tài khoản nguồn',
  })

type Props = { open: boolean; onOpenChange: (open: boolean) => void; transaction?: Transaction }

export function TransactionFormSheet({ open, onOpenChange, transaction }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>{transaction ? 'Sửa giao dịch' : 'Giao dịch mới'}</SheetTitle>
        </SheetHeader>
        <TransactionForm key={transaction?.id ?? 'new'} transaction={transaction} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function nowLocal() {
  return toDateTimeLocal(new Date().toISOString())
}

// Waits for accounts/categories so the form's defaults (first account) are known when it mounts.
function TransactionForm({ transaction, onDone }: { transaction?: Transaction; onDone: () => void }) {
  const accounts = useQuery(accountsQuery)
  const categories = useQuery(categoriesQuery)

  if (accounts.isPending || categories.isPending) {
    return <p className="px-4 pb-6 text-sm text-muted-foreground">Đang tải…</p>
  }
  if (accounts.isError || categories.isError) {
    return (
      <div className="px-4 pb-6">
        <FormError message={(accounts.error ?? categories.error)?.message} />
      </div>
    )
  }
  return <TransactionFormBody transaction={transaction} accounts={accounts.data} categories={categories.data} onDone={onDone} />
}

function TransactionFormBody({
  transaction,
  accounts,
  categories,
  onDone,
}: {
  transaction?: Transaction
  accounts: Account[]
  categories: Category[]
  onDone: () => void
}) {
  const online = useOnlineStatus()
  const saveTransaction = useSaveTransaction()
  const deleteTransaction = useDeleteTransaction()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Hidden accounts stay selectable when editing a transaction that already uses them.
  const accountOptions = accounts
    .filter((a) => a.is_active || a.id === transaction?.account_id || a.id === transaction?.to_account_id)
    .map((a) => ({ value: String(a.id), label: a.name }))
  const firstAccount = accountOptions[0]?.value ?? ''

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? 'expense',
      amount: transaction ? transaction.amount.split('.')[0] : '',
      account_id: transaction ? String(transaction.account_id) : firstAccount,
      to_account_id: transaction?.to_account_id ? String(transaction.to_account_id) : '',
      category_id: transaction?.category_id ? String(transaction.category_id) : NO_CATEGORY,
      occurred: transaction ? toDateTimeLocal(transaction.occurred_at) : nowLocal(),
      description: transaction?.description ?? '',
    },
  })
  const type = useWatch({ control, name: 'type' })
  const categoryOptions = [
    { value: NO_CATEGORY, label: 'Không phân loại' },
    ...categories.filter((c) => c.type === type).map((c) => ({ value: String(c.id), label: c.name })),
  ]

  function changeType(next: TransactionType) {
    setValue('type', next)
    // A category belongs to one type; transfers have none.
    setValue('category_id', NO_CATEGORY)
    if (next !== 'transfer') setValue('to_account_id', '')
  }

  const onSubmit = handleSubmit(async (v) => {
    try {
      await saveTransaction.mutateAsync({
        id: transaction?.id ?? crypto.randomUUID(),
        input: {
          type: v.type,
          amount: v.amount,
          account_id: Number(v.account_id),
          to_account_id: v.type === 'transfer' ? Number(v.to_account_id) : null,
          category_id: v.type === 'transfer' || v.category_id === NO_CATEGORY ? null : Number(v.category_id),
          occurred_at: fromDateTimeLocal(v.occurred)!,
          description: v.description.trim() || null,
        },
      })
      toast.success(transaction ? 'Đã lưu thay đổi' : `Đã ghi ${formatVnd(v.amount)}`)
      onDone()
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  async function handleDelete() {
    try {
      await deleteTransaction.mutateAsync(transaction!.id)
      toast.success('Đã xoá giao dịch')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được giao dịch')
    }
  }

  if (accountOptions.length === 0) {
    return (
      <div className="px-4 pb-6">
        <FormError message="Bạn chưa có tài khoản nào. Hãy tạo tài khoản (tiền mặt, ngân hàng, ví) trước." />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && <FormError message="Bạn đang offline. Cần có mạng để lưu (ghi offline sẽ có ở bản sau)." />}
      <FormError message={errors.root?.message} />

      <div role="tablist" aria-label="Loại giao dịch" className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/40 p-1">
        {transactionTypeOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => changeType(value)}
            className={cn(
              'rounded-lg py-2 text-sm font-medium transition-colors',
              type === value
                ? value === 'income'
                  ? 'bg-success/15 text-success'
                  : value === 'expense'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-accent text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <MoneyField label="Số tiền" value={field.value} onChange={field.onChange} error={errors.amount?.message} autoFocus={!transaction} />
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="account_id"
          render={({ field }) => (
            <SelectField
              label={type === 'transfer' ? 'Từ tài khoản' : 'Tài khoản'}
              value={field.value}
              onChange={field.onChange}
              options={accountOptions}
              error={errors.account_id?.message}
            />
          )}
        />
        {type === 'transfer' ? (
          <Controller
            control={control}
            name="to_account_id"
            render={({ field }) => (
              <SelectField
                label="Đến tài khoản"
                value={field.value}
                onChange={field.onChange}
                options={accountOptions}
                error={errors.to_account_id?.message}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <SelectField
                label="Danh mục"
                value={field.value}
                onChange={field.onChange}
                options={categoryOptions}
                error={errors.category_id?.message}
              />
            )}
          />
        )}
      </div>

      <TextField label="Thời gian" type="datetime-local" error={errors.occurred?.message} {...register('occurred')} />
      <TextField label="Ghi chú" placeholder="Không bắt buộc" error={errors.description?.message} {...register('description')} />

      <SubmitButton pending={isSubmitting} disabled={!online}>
        {transaction ? 'Lưu thay đổi' : 'Lưu giao dịch'}
      </SubmitButton>

      {transaction && (
        <>
          <Button type="button" variant="destructive" size="lg" disabled={!online} onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Xoá giao dịch
          </Button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xoá giao dịch này?</AlertDialogTitle>
                <AlertDialogDescription>
                  Giao dịch {formatVnd(transaction.amount)} sẽ bị xoá và số dư tài khoản được tính lại.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Huỷ</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Xoá
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </form>
  )
}

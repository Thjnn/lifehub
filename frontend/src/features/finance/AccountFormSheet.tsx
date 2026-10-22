import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, MoneyField, SelectField, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isDebtType, useDeleteAccount, useSaveAccount, type Account } from '@/features/finance/api'
import { accountTypeOptions } from '@/features/finance/labels'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { applyServerErrors, zodResolver } from '@/lib/form'

const digits = z.string().regex(/^\d{0,13}$/, 'Số tiền không hợp lệ')

const schema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập tên tài khoản').max(100, 'Tối đa 100 ký tự'),
    account_type: z.enum(['cash', 'bank', 'ewallet', 'liability', 'receivable']),
    opening_balance: digits,
    is_active: z.boolean(),
    schedule: z.enum(['none', 'once', 'monthly']),
    due_date: z.string(),
    due_day: z.string(),
    installment: digits,
  })
  .refine((v) => v.schedule !== 'once' || v.due_date !== '', { path: ['due_date'], message: 'Chọn ngày phải trả' })

const scheduleOptions = [
  { value: 'none', label: 'Không có hạn' },
  { value: 'once', label: 'Một lần, vào ngày…' },
  { value: 'monthly', label: 'Hằng tháng (trả góp, SPayLater)' },
] as const

const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Ngày ${i + 1}` }))

type Props = { open: boolean; onOpenChange: (open: boolean) => void; account?: Account }

export function AccountFormSheet({ open, onOpenChange, account }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>{account ? 'Sửa tài khoản' : 'Tài khoản mới'}</SheetTitle>
        </SheetHeader>
        <AccountForm key={account?.id ?? 'new'} account={account} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

const wholeVnd = (amount: string | null | undefined) => (amount ? amount.split('.')[0].replace('-', '') : '')

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const online = useOnlineStatus()
  const saveAccount = useSaveAccount()
  const deleteAccount = useDeleteAccount()
  const [deleting, setDeleting] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? '',
      account_type: account?.account_type ?? 'cash',
      // Entered as a positive amount; a liability is stored negative (what I owe).
      opening_balance: wholeVnd(account?.opening_balance),
      is_active: account?.is_active ?? true,
      schedule: (account?.due_date ? 'once' : account?.due_day ? 'monthly' : 'none') as 'none' | 'once' | 'monthly',
      due_date: account?.due_date ?? '',
      due_day: String(account?.due_day ?? 10),
      installment: wholeVnd(account?.installment_amount),
    },
  })
  const type = useWatch({ control, name: 'account_type' })
  const schedule = useWatch({ control, name: 'schedule' })
  const debt = isDebtType(type)

  const onSubmit = handleSubmit(async (v) => {
    const amount = v.opening_balance || '0'
    const withSchedule = debt && v.schedule !== 'none'
    try {
      await saveAccount.mutateAsync({
        id: account?.id,
        input: {
          name: v.name,
          account_type: v.account_type,
          is_active: v.is_active,
          opening_balance: v.account_type === 'liability' && amount !== '0' ? `-${amount}` : amount,
          // Always sent, so switching type or schedule clears the old values.
          due_date: withSchedule && v.schedule === 'once' ? v.due_date : null,
          due_day: withSchedule && v.schedule === 'monthly' ? Number(v.due_day) : null,
          installment_amount: withSchedule && v.schedule === 'monthly' && v.installment ? v.installment : null,
        },
      })
      toast.success(account ? 'Đã lưu tài khoản' : 'Đã tạo tài khoản')
      onDone()
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  // The API refuses (409) when the account has transactions — its message suggests hiding instead.
  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteAccount.mutateAsync(account!.id)
      toast.success('Đã xoá tài khoản')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được tài khoản')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && <FormError message="Bạn đang offline. Cần có mạng để lưu." />}
      <FormError message={errors.root?.message} />
      <Controller
        control={control}
        name="account_type"
        render={({ field }) => <SelectField label="Loại" value={field.value} onChange={field.onChange} options={accountTypeOptions} />}
      />
      <TextField
        label={type === 'liability' ? 'Nợ ai / trả sau ở đâu' : type === 'receivable' ? 'Ai đang nợ bạn' : 'Tên tài khoản'}
        placeholder={
          type === 'liability' ? 'VD: SPayLater, Thẻ tín dụng, Nợ Minh' : type === 'receivable' ? 'VD: Lan mượn' : 'VD: Tiền mặt, Vietcombank, MoMo'
        }
        autoFocus={!account}
        error={errors.name?.message ?? errors.account_type?.message}
        {...register('name')}
      />
      <Controller
        control={control}
        name="opening_balance"
        render={({ field }) => (
          <MoneyField
            label={type === 'liability' ? 'Số tiền đang nợ' : type === 'receivable' ? 'Số tiền họ đang nợ bạn' : 'Số dư ban đầu'}
            value={field.value}
            onChange={field.onChange}
            error={errors.opening_balance?.message}
          />
        )}
      />
      {type === 'liability' && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Mua bằng trả sau thì ghi <b>Chi</b> từ tài khoản này; trả mỗi kỳ thì ghi <b>Chuyển khoản</b> vào đây — chi tiêu chỉ tính 1 lần.
        </p>
      )}

      {debt && (
        <>
          <Controller
            control={control}
            name="schedule"
            render={({ field }) => (
              <SelectField label="Lịch trả" value={field.value} onChange={field.onChange} options={[...scheduleOptions]} />
            )}
          />
          {schedule === 'once' && <TextField label="Ngày phải trả" type="date" error={errors.due_date?.message} {...register('due_date')} />}
          {schedule === 'monthly' && (
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={control}
                name="due_day"
                render={({ field }) => (
                  <SelectField label="Trả vào" value={field.value} onChange={field.onChange} options={dayOptions} error={errors.due_day?.message} />
                )}
              />
              <Controller
                control={control}
                name="installment"
                render={({ field }) => <MoneyField label="Mỗi kỳ (tuỳ chọn)" value={field.value} onChange={field.onChange} />}
              />
            </div>
          )}
        </>
      )}

      {account && (
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox id="account-active" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="account-active">Đang dùng (bỏ chọn để ẩn tài khoản)</Label>
            </div>
          )}
        />
      )}
      <SubmitButton pending={isSubmitting} disabled={!online}>
        {account ? 'Lưu' : 'Tạo tài khoản'}
      </SubmitButton>
      {account && (
        <Button type="button" variant="destructive" size="lg" disabled={!online || deleting} onClick={handleDelete}>
          <Trash2 />
          Xoá tài khoản
        </Button>
      )}
    </form>
  )
}

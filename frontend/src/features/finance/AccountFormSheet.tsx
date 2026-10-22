import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, MoneyField, SelectField, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDeleteAccount, useSaveAccount, type Account } from '@/features/finance/api'
import { accountTypeOptions } from '@/features/finance/labels'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên tài khoản').max(100, 'Tối đa 100 ký tự'),
  account_type: z.enum(['cash', 'bank', 'ewallet']),
  opening_balance: z.string().regex(/^\d{0,13}$/, 'Số tiền không hợp lệ'),
  is_active: z.boolean(),
})

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
      // Whole VND in the UI (spec §9.4); negative opening balances aren't offered.
      opening_balance: account ? account.opening_balance.split('.')[0].replace('-', '') : '',
      is_active: account?.is_active ?? true,
    },
  })

  const onSubmit = handleSubmit(async ({ opening_balance, ...values }) => {
    try {
      await saveAccount.mutateAsync({ id: account?.id, input: { ...values, opening_balance: opening_balance || '0' } })
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
      <TextField label="Tên tài khoản" placeholder="VD: Tiền mặt, Vietcombank, MoMo" autoFocus={!account} error={errors.name?.message} {...register('name')} />
      <Controller
        control={control}
        name="account_type"
        render={({ field }) => <SelectField label="Loại" value={field.value} onChange={field.onChange} options={accountTypeOptions} />}
      />
      <Controller
        control={control}
        name="opening_balance"
        render={({ field }) => (
          <MoneyField label="Số dư ban đầu" value={field.value} onChange={field.onChange} error={errors.opening_balance?.message} />
        )}
      />
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

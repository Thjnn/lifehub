import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { meQuery, type User } from '@/features/auth/api'
import { toAvatarDataUrl } from '@/features/settings/avatar'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { api } from '@/lib/api-client'
import { applyServerErrors, zodResolver } from '@/lib/form'

const nameSchema = z.object({ name: z.string().trim().min(1, 'Vui lòng nhập tên').max(255) })

// Mirrors backend rules: Password::defaults() = min 8.
const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Mật khẩu nhập lại không khớp' })

// /app/settings/profile: display name and password (email is the login and stays fixed).
export function ProfilePage() {
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const me = useQuery(meQuery)

  const nameForm = useForm({ resolver: zodResolver(nameSchema), values: { name: me.data?.name ?? '' } })
  const saveName = nameForm.handleSubmit(async (values) => {
    try {
      const { data } = await api<{ data: User }>('/me', { method: 'PATCH', body: values })
      queryClient.setQueryData(meQuery.queryKey, data)
      toast.success('Đã đổi tên')
    } catch (error) {
      applyServerErrors(error, nameForm.setError)
    }
  })

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })
  const savePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await api('/me/password', { method: 'PUT', body: values })
      passwordForm.reset()
      toast.success('Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.')
    } catch (error) {
      applyServerErrors(error, passwordForm.setError)
    }
  })

  const fileInput = useRef<HTMLInputElement>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  async function saveAvatar(avatar: string | null, message: string) {
    setSavingAvatar(true)
    try {
      const { data } = await api<{ data: User }>('/me', { method: 'PATCH', body: { avatar } })
      queryClient.setQueryData(meQuery.queryKey, data)
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được ảnh')
    } finally {
      setSavingAvatar(false)
    }
  }
  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires onChange
    if (!file) return
    try {
      await saveAvatar(await toAvatarDataUrl(file), 'Đã đổi ảnh đại diện')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đọc được ảnh')
    }
  }

  const nameErrors = nameForm.formState.errors
  const passwordErrors = passwordForm.formState.errors

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {!online && <FormError message="Bạn đang offline. Cần có mạng để đổi hồ sơ." />}

      <section className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <UserAvatar user={me.data} className="size-20 text-xl" />
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Ảnh đại diện</h2>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!online || savingAvatar} onClick={() => fileInput.current?.click()}>
              <Camera />
              {savingAvatar ? 'Đang lưu…' : me.data?.avatar ? 'Đổi ảnh' : 'Chọn ảnh'}
            </Button>
            {me.data?.avatar && (
              <Button size="sm" variant="ghost" disabled={!online || savingAvatar} onClick={() => saveAvatar(null, 'Đã gỡ ảnh đại diện')}>
                Gỡ ảnh
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Ảnh được cắt vuông và thu nhỏ ngay trên máy trước khi gửi.</p>
        </div>
      </section>

      <form onSubmit={saveName} noValidate className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Thông tin</h2>
        <TextField label="Email" value={me.data?.email ?? ''} disabled readOnly />
        <TextField label="Tên hiển thị" autoComplete="name" error={nameErrors.name?.message} {...nameForm.register('name')} />
        <FormError message={nameErrors.root?.message} />
        <div className="self-start">
          <SubmitButton pending={nameForm.formState.isSubmitting} disabled={!online}>
            Lưu tên
          </SubmitButton>
        </div>
      </form>

      <form onSubmit={savePassword} noValidate className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Đổi mật khẩu</h2>
        <TextField
          label="Mật khẩu hiện tại"
          type="password"
          autoComplete="current-password"
          error={passwordErrors.current_password?.message}
          {...passwordForm.register('current_password')}
        />
        <TextField label="Mật khẩu mới" type="password" autoComplete="new-password" error={passwordErrors.password?.message} {...passwordForm.register('password')} />
        <TextField
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="new-password"
          error={passwordErrors.password_confirmation?.message}
          {...passwordForm.register('password_confirmation')}
        />
        <FormError message={passwordErrors.root?.message} />
        <div className="self-start">
          <SubmitButton pending={passwordForm.formState.isSubmitting} disabled={!online}>
            Đổi mật khẩu
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}

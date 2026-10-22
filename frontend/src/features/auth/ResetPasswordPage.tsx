import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPassword } from '@/features/auth/api'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z
  .object({
    email: z.email(),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Mật khẩu nhập lại không khớp',
  })

// Reached from the email link: /reset-password?token=…&email=… (built in backend AppServiceProvider).
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '', password: '', password_confirmation: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { message } = await resetPassword({ ...values, token })
      toast.success(message)
      navigate('/login', { replace: true })
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Đặt lại mật khẩu</CardTitle>
        <CardDescription>Mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</CardDescription>
      </CardHeader>
      <CardContent>
        {token ? (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <FormError message={errors.root?.message} />
            {/* Read-only, but kept as a field so a server error ("link expired") shows right here */}
            <TextField label="Email" type="email" readOnly error={errors.email?.message} {...register('email')} />
            <TextField
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Nhập lại mật khẩu mới"
              type="password"
              autoComplete="new-password"
              error={errors.password_confirmation?.message}
              {...register('password_confirmation')}
            />
            <SubmitButton pending={isSubmitting}>Đặt lại mật khẩu</SubmitButton>
          </form>
        ) : (
          <FormError message="Link đặt lại mật khẩu không hợp lệ. Hãy yêu cầu link mới." />
        )}
      </CardContent>
      <CardFooter className="justify-center gap-4 text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Gửi lại link
        </Link>
        <Link to="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}

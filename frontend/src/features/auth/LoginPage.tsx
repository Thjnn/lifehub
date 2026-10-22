import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from '@/features/auth/api'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export function LoginPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values)
      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Đăng nhập</CardTitle>
        <CardDescription>Chào mừng bạn quay lại LIFEHUB.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={errors.root?.message} />
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Link to="/forgot-password" className="-mt-2 self-end text-sm text-primary hover:underline">
            Quên mật khẩu?
          </Link>
          <SubmitButton pending={isSubmitting}>Đăng nhập</SubmitButton>
        </form>
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        Chưa có tài khoản?
        <Link to="/register" className="text-primary hover:underline">
          Đăng ký
        </Link>
      </CardFooter>
    </Card>
  )
}

import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { register as registerAccount } from '@/features/auth/api'
import { applyServerErrors, zodResolver } from '@/lib/form'

// Mirrors backend rules: Password::defaults() = min 8.
const schema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập tên').max(255),
    email: z.email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Mật khẩu nhập lại không khớp',
  })

export function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerAccount({ ...values, email: values.email.toLowerCase() })
      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tạo tài khoản</CardTitle>
        <CardDescription>Bắt đầu quản lý lịch, công việc và chi tiêu.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={errors.root?.message} />
          <TextField label="Tên" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            error={errors.password_confirmation?.message}
            {...register('password_confirmation')}
          />
          <SubmitButton pending={isSubmitting}>Đăng ký</SubmitButton>
        </form>
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        Đã có tài khoản?
        <Link to="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}

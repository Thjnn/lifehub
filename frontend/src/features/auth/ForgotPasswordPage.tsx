import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { forgotPassword } from '@/features/auth/api'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z.object({ email: z.email('Email không hợp lệ') })

export function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { message } = await forgotPassword(values)
      setSentMessage(message)
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Quên mật khẩu</CardTitle>
        <CardDescription>Nhập email, chúng tôi sẽ gửi link để đặt lại mật khẩu.</CardDescription>
      </CardHeader>
      <CardContent>
        {sentMessage ? (
          <div role="status" className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {sentMessage}
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <FormError message={errors.root?.message} />
            <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <SubmitButton pending={isSubmitting}>Gửi link đặt lại</SubmitButton>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}

import { useId, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function TextField({ label, error, ...props }: ComponentProps<typeof Input> & { label: string; error?: string }) {
  const id = useId()

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={!!error} className="h-10" {...props} />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </div>
  )
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}

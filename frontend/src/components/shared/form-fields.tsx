import { useId, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { groupDigits, parseVndInput } from '@/lib/money'

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

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  error?: string
}) {
  const id = useId()

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} aria-invalid={!!error} className="w-full data-[size=default]:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

// Whole-VND amount input: value is digits only ("1500000"), shown grouped ("1.500.000 ₫").
export function MoneyField({
  label,
  value,
  onChange,
  error,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (digits: string) => void
  error?: string
  autoFocus?: boolean
}) {
  const id = useId()

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={!!error}
          className="h-12 pr-8 text-lg font-semibold tabular-nums"
          placeholder="0"
          value={groupDigits(value)}
          onChange={(e) => onChange(parseVndInput(e.target.value))}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">₫</span>
      </div>
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

export function SubmitButton({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending || disabled} className="w-full">
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}

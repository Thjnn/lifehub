import type { FieldError, FieldErrors, FieldValues, Path, Resolver, UseFormSetError } from 'react-hook-form'
import type { z } from 'zod'
import { ApiError } from '@/lib/api-client'

// ponytail: own resolver because @hookform/resolvers has an upstream peer-dependency conflict.
// Handles flat forms only (nested paths become "a.b" keys); switch to @hookform/resolvers once it installs cleanly.
export function zodResolver<Input extends FieldValues, Output extends FieldValues>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)
    if (result.success) return { values: result.data, errors: {} }

    const errors: Record<string, FieldError> = {}
    for (const issue of result.error.issues) {
      errors[issue.path.join('.')] ??= { type: issue.code, message: issue.message }
    }
    return { values: {}, errors: errors as FieldErrors<Input> }
  }
}

// Laravel 422 → per-field errors; anything else → form-level error (errors.root).
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError && Object.keys(error.errors).length > 0) {
    for (const [field, messages] of Object.entries(error.errors)) {
      setError(field as Path<T>, { message: messages[0] })
    }
    return
  }
  setError('root', { message: error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.' })
}

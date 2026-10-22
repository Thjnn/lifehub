import { useState } from 'react'
import { Repeat as RepeatIcon, Trash2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, SelectField, SubmitButton, TextField } from '@/components/shared/form-fields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useDeleteEvent, useSaveEvent, type Occurrence } from '@/features/calendar/api'
import { eventStatusOptions, eventTypeOptions } from '@/features/calendar/labels'
import { buildRule, parseRule, repeatOptions } from '@/features/calendar/recurrence'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Vui lòng nhập tên sự kiện').max(255, 'Tối đa 255 ký tự'),
    description: z.string().max(5000, 'Tối đa 5000 ký tự'),
    start: z.string().min(1, 'Chọn giờ bắt đầu'),
    end: z.string().min(1, 'Chọn giờ kết thúc'),
    event_type: z.enum(['study', 'work', 'workout', 'rest', 'personal']),
    status: z.enum(['scheduled', 'completed', 'cancelled']),
    repeat: z.enum(['none', 'daily', 'weekly', 'monthly']),
    until: z.string(),
  })
  .refine((v) => !v.start || !v.end || new Date(v.end) > new Date(v.start), {
    path: ['end'],
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
  })

export type NewEventDefaults = { start: Date; end: Date }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  occurrence?: Occurrence // undefined = create
  defaults?: NewEventDefaults
}

export function EventFormSheet({ open, onOpenChange, occurrence, defaults }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>{occurrence ? 'Sửa sự kiện' : 'Sự kiện mới'}</SheetTitle>
        </SheetHeader>
        <EventForm
          key={occurrence?.key ?? defaults?.start.toISOString() ?? 'new'}
          occurrence={occurrence}
          defaults={defaults}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

// Next full hour → +1h
function nextHourSlot(): NewEventDefaults {
  const start = new Date()
  start.setHours(start.getHours() + 1, 0, 0, 0)
  return { start, end: new Date(start.getTime() + 3_600_000) }
}

function EventForm({ occurrence, defaults, onDone }: { occurrence?: Occurrence; defaults?: NewEventDefaults; onDone: () => void }) {
  const online = useOnlineStatus()
  const saveEvent = useSaveEvent()
  const deleteEvent = useDeleteEvent()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const recurring = !!occurrence?.recurrence_rule
  const slot = defaults ?? nextHourSlot()
  const rule = parseRule(occurrence?.recurrence_rule ?? null)

  const {
    register,
    control,

    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: occurrence?.title ?? '',
      description: occurrence?.description ?? '',
      // Editing changes the whole series, so the form shows the series' first occurrence.
      start: toDateTimeLocal(occurrence?.series_start_at ?? slot.start.toISOString()),
      end: toDateTimeLocal(occurrence?.series_end_at ?? slot.end.toISOString()),
      event_type: occurrence?.event_type ?? 'study',
      status: occurrence?.status ?? 'scheduled',
      repeat: rule.repeat,
      until: rule.until,
    },
  })
  const repeat = useWatch({ control, name: 'repeat' })

  const onSubmit = handleSubmit(async ({ start, end, repeat, until, description, ...values }) => {
    try {
      const { meta } = await saveEvent.mutateAsync({
        id: occurrence?.id,
        input: {
          ...values,
          description: description.trim() || null,
          start_at: fromDateTimeLocal(start)!,
          end_at: fromDateTimeLocal(end)!,
          recurrence_rule: buildRule(repeat, until),
        },
      })
      // Overlaps warn, never block (spec §9.2).
      if (meta.overlaps.length > 0) {
        toast.warning(`Đã lưu, nhưng trùng giờ với: ${meta.overlaps.map((o) => o.title).join(', ')}`)
      } else {
        toast.success(occurrence ? 'Đã lưu thay đổi' : 'Đã thêm sự kiện')
      }
      onDone()
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  async function handleDelete() {
    try {
      await deleteEvent.mutateAsync(occurrence!.id)
      toast.success('Đã xoá sự kiện')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được sự kiện')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && <FormError message="Bạn đang offline. Lịch chỉ xem được, cần có mạng để lưu." />}
      <FormError message={errors.root?.message} />
      {recurring && (
        <p className="flex items-center gap-2 rounded-lg border bg-accent/50 p-3 text-sm text-muted-foreground">
          <RepeatIcon className="size-4 shrink-0" aria-hidden />
          Sự kiện lặp lại: thay đổi áp dụng cho cả chuỗi.
        </p>
      )}
      <TextField label="Tên sự kiện" autoFocus={!occurrence} error={errors.title?.message} {...register('title')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Bắt đầu" type="datetime-local" error={errors.start?.message} {...register('start')} />
        <TextField label="Kết thúc" type="datetime-local" error={errors.end?.message} {...register('end')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="event_type"
          render={({ field }) => (
            <SelectField label="Loại" value={field.value} onChange={field.onChange} options={eventTypeOptions} />
          )}
        />
        {occurrence ? (
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SelectField label="Trạng thái" value={field.value} onChange={field.onChange} options={eventStatusOptions} />
            )}
          />
        ) : (
          <div />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="repeat"
          render={({ field }) => (
            <SelectField label="Lặp lại" value={field.value} onChange={field.onChange} options={repeatOptions} />
          )}
        />
        {repeat !== 'none' && <TextField label="Đến ngày (tuỳ chọn)" type="date" {...register('until')} />}
      </div>
      <Field>
        <FieldLabel htmlFor="event-description">Ghi chú</FieldLabel>
        <Textarea id="event-description" rows={3} placeholder="Không bắt buộc" {...register('description')} />
      </Field>

      <SubmitButton pending={isSubmitting} disabled={!online}>
        {occurrence ? 'Lưu thay đổi' : 'Thêm sự kiện'}
      </SubmitButton>

      {occurrence && (
        <>
          <Button type="button" variant="destructive" size="lg" disabled={!online} onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            {recurring ? 'Xoá cả chuỗi' : 'Xoá sự kiện'}
          </Button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{recurring ? 'Xoá cả chuỗi lặp lại?' : 'Xoá sự kiện này?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {recurring
                    ? `Mọi lần lặp của "${occurrence.title}" sẽ bị xoá.`
                    : `"${occurrence.title}" sẽ bị xoá và không khôi phục được.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Huỷ</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Xoá
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </form>
  )
}

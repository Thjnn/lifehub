import { useState } from 'react'
import { Link2, Trash2, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, SubmitButton, TextField } from '@/components/shared/form-fields'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useDeleteNote, useSaveNote, type Note } from '@/features/notes/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z.object({
  title: z.string().max(255, 'Tối đa 255 ký tự'),
  body: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(20000, 'Tối đa 20000 ký tự'),
  pinned: z.boolean(),
})

export type NoteLink = Pick<Note, 'task_id' | 'event_id'>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note // undefined = create
  link?: NoteLink // for a new note opened from a task/event
}

export function NoteFormSheet({ open, onOpenChange, note, link }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>{note ? 'Sửa ghi chú' : 'Ghi chú mới'}</SheetTitle>
        </SheetHeader>
        <NoteForm key={note?.id ?? 'new'} note={note} link={link} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function NoteForm({ note, link, onDone }: { note?: Note; link?: NoteLink; onDone: () => void }) {
  const online = useOnlineStatus()
  const saveNote = useSaveNote()
  const deleteNote = useDeleteNote()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linked, setLinked] = useState<NoteLink>({ task_id: note?.task_id ?? link?.task_id ?? null, event_id: note?.event_id ?? link?.event_id ?? null })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: note?.title ?? '', body: note?.body ?? '', pinned: note?.pinned ?? false },
  })

  const onSubmit = handleSubmit(async ({ title, ...values }) => {
    try {
      const { queued } = await saveNote.mutateAsync({
        id: note?.id ?? crypto.randomUUID(),
        created: !note,
        input: { ...values, title: title.trim() || null, ...linked },
      })
      if (queued) toast.info('Đã lưu trên máy — sẽ tự đồng bộ khi có mạng')
      else toast.success(note ? 'Đã lưu ghi chú' : 'Đã thêm ghi chú')
      onDone()
    } catch (error) {
      // The linked task/event was deleted meanwhile: not a field of this form, so say it at the top.
      if (error instanceof ApiError && (error.errors.task_id || error.errors.event_id))
        setError('root', { message: 'Công việc/sự kiện được gắn không còn tồn tại. Bỏ gắn rồi lưu lại.' })
      else applyServerErrors(error, setError)
    }
  })

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync(note!.id)
      toast.success('Đã xoá ghi chú')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được ghi chú')
    }
  }

  const linkLabel = linked.task_id ? 'Gắn với một công việc' : linked.event_id ? 'Gắn với một sự kiện' : null

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && (
        <p className="rounded-lg border bg-accent/50 p-3 text-sm text-muted-foreground">
          Bạn đang offline. Ghi chú được lưu trên máy và tự đồng bộ khi có mạng (xoá cần có mạng).
        </p>
      )}
      <FormError message={errors.root?.message} />
      <TextField label="Tiêu đề" placeholder="Không bắt buộc" error={errors.title?.message} {...register('title')} />
      <Field data-invalid={!!errors.body}>
        <FieldLabel htmlFor="note-body">Nội dung</FieldLabel>
        <Textarea id="note-body" rows={8} autoFocus={!note} aria-invalid={!!errors.body} {...register('body')} />
        <FieldError>{errors.body?.message}</FieldError>
      </Field>
      <Controller
        control={control}
        name="pinned"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            Ghim lên đầu
          </label>
        )}
      />
      {linkLabel && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Link2 className="size-4" aria-hidden />
            {linkLabel}
          </span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Bỏ gắn" onClick={() => setLinked({ task_id: null, event_id: null })}>
            <X />
          </Button>
        </div>
      )}

      <SubmitButton pending={isSubmitting}>{note ? 'Lưu ghi chú' : 'Thêm ghi chú'}</SubmitButton>

      {note && (
        <>
          <Button type="button" variant="destructive" size="lg" disabled={!online} onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Xoá ghi chú
          </Button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xoá ghi chú này?</AlertDialogTitle>
                <AlertDialogDescription>Ghi chú sẽ bị xoá và không khôi phục được.</AlertDialogDescription>
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

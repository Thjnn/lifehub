import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
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
import { LinkedNotes } from '@/features/notes/LinkedNotes'
import { useDeleteTask, useSaveTask, type Task } from '@/features/tasks/api'
import { priorityOptions, statusOptions } from '@/features/tasks/labels'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { applyServerErrors, zodResolver } from '@/lib/form'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên công việc').max(255, 'Tối đa 255 ký tự'),
  description: z.string().max(5000, 'Tối đa 5000 ký tự'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']),
  due: z.string(), // datetime-local value, "" = no deadline
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task // undefined = create
}

export function TaskFormSheet({ open, onOpenChange, task }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>{task ? 'Sửa công việc' : 'Công việc mới'}</SheetTitle>
        </SheetHeader>
        {/* key: reset the form whenever a different task is opened */}
        <TaskForm key={task?.id ?? 'new'} task={task} onDone={() => onOpenChange(false)} />
        {task && <LinkedNotes link={{ task_id: task.id, event_id: null }} />}
      </SheetContent>
    </Sheet>
  )
}

function TaskForm({ task, onDone }: { task?: Task; onDone: () => void }) {
  const online = useOnlineStatus()
  const saveTask = useSaveTask()
  const deleteTask = useDeleteTask()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      due: toDateTimeLocal(task?.due_at ?? null),
    },
  })

  const onSubmit = handleSubmit(async ({ due, description, ...values }) => {
    try {
      const { queued } = await saveTask.mutateAsync({
        id: task?.id ?? crypto.randomUUID(),
        created: !task,
        input: { ...values, description: description.trim() || null, due_at: fromDateTimeLocal(due) },
      })
      if (queued) toast.info('Đã lưu trên máy — sẽ tự đồng bộ khi có mạng')
      else toast.success(task ? 'Đã lưu thay đổi' : 'Đã thêm công việc')
      onDone()
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  async function handleDelete() {
    try {
      await deleteTask.mutateAsync(task!.id)
      toast.success('Đã xoá công việc')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được công việc')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      {!online && (
        <p className="rounded-lg border bg-accent/50 p-3 text-sm text-muted-foreground">
          Bạn đang offline. Thay đổi được lưu trên máy và tự đồng bộ khi có mạng (xoá cần có mạng).
        </p>
      )}
      <FormError message={errors.root?.message} />
      <TextField label="Tên công việc" autoFocus={!task} error={errors.title?.message} {...register('title')} />
      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="task-description">Mô tả</FieldLabel>
        <Textarea id="task-description" rows={3} placeholder="Không bắt buộc" {...register('description')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <SelectField label="Ưu tiên" value={field.value} onChange={field.onChange} options={priorityOptions} />
          )}
        />
        {task && (
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SelectField label="Trạng thái" value={field.value} onChange={field.onChange} options={statusOptions} />
            )}
          />
        )}
      </div>
      <TextField label="Hạn chót" type="datetime-local" error={errors.due?.message} {...register('due')} />

      <SubmitButton pending={isSubmitting}>{task ? 'Lưu thay đổi' : 'Thêm công việc'}</SubmitButton>

      {task && (
        <>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={!online}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            Xoá công việc
          </Button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xoá công việc này?</AlertDialogTitle>
                <AlertDialogDescription>"{task.title}" sẽ bị xoá và không khôi phục được.</AlertDialogDescription>
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

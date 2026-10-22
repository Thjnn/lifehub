import type { Task, TaskPriority, TaskStatus } from '@/features/tasks/api'

export const priorityOptions: { value: TaskPriority; label: string; className: string }[] = [
  { value: 'urgent', label: 'Khẩn cấp', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
  { value: 'high', label: 'Cao', className: 'border-warning/40 bg-warning/10 text-warning' },
  { value: 'medium', label: 'Trung bình', className: 'border-primary/40 bg-primary/10 text-primary' },
  { value: 'low', label: 'Thấp', className: 'text-muted-foreground' },
]

export const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Cần làm' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Đã xong' },
  { value: 'cancelled', label: 'Đã huỷ' },
]

export const priorityOption = (value: TaskPriority) => priorityOptions.find((o) => o.value === value)!
export const statusLabel = (value: TaskStatus) => statusOptions.find((o) => o.value === value)!.label

// Past its deadline and still open (same rule as the API's ?overdue=1).
export const isOverdue = (task: Pick<Task, 'status' | 'due_at'>, now = new Date()) =>
  (task.status === 'todo' || task.status === 'in_progress') && task.due_at !== null && new Date(task.due_at) < now

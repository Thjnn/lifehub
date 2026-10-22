import type { TaskFilters, TaskPriority, TaskStatus } from '@/features/tasks/api'

export type QuickView = 'all' | 'today' | 'upcoming' | 'overdue'
export type StatusView = 'open' | 'completed' | 'cancelled' | 'any'
export type SortView = NonNullable<TaskFilters['sort']>

export const quickViews: { value: QuickView; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: '7 ngày tới' },
  { value: 'overdue', label: 'Quá hạn' },
]

export const statusViews: { value: StatusView; label: string }[] = [
  { value: 'open', label: 'Chưa xong' },
  { value: 'completed', label: 'Đã xong' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: 'any', label: 'Mọi trạng thái' },
]

export const sortViews: { value: SortView; label: string }[] = [
  { value: 'due_at', label: 'Theo hạn' },
  { value: 'priority', label: 'Theo ưu tiên' },
  { value: 'created_at', label: 'Mới tạo' },
]

const statusesFor: Record<StatusView, TaskStatus[] | undefined> = {
  open: ['todo', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  any: undefined,
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

// UI choices → API query. Day boundaries use the device's local timezone.
export function buildTaskFilters(
  view: { quick: QuickView; status: StatusView; priority: TaskPriority | 'any'; sort: SortView },
  now = new Date(),
): TaskFilters {
  const filters: TaskFilters = {
    status: statusesFor[view.status],
    priority: view.priority === 'any' ? undefined : [view.priority],
    sort: view.sort,
  }

  if (view.quick === 'today') {
    filters.due_from = startOfDay(now).toISOString()
    filters.due_to = endOfDay(now).toISOString()
  } else if (view.quick === 'upcoming') {
    // Day boundaries, not `now`: the result is part of the query key, so it must stay stable across renders.
    filters.due_from = startOfDay(now).toISOString()
    filters.due_to = endOfDay(new Date(now.getTime() + 7 * 86_400_000)).toISOString()
  } else if (view.quick === 'overdue') {
    filters.overdue = true
  }

  return filters
}

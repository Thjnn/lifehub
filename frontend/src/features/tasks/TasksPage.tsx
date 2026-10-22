import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ListTodo, Plus, RotateCw, WifiOff } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { tasksQuery, type Task, type TaskPriority } from '@/features/tasks/api'
import {
  buildTaskFilters,
  quickViews,
  sortViews,
  statusViews,
  type QuickView,
  type SortView,
  type StatusView,
} from '@/features/tasks/filters'
import { priorityOptions } from '@/features/tasks/labels'
import { TaskFormSheet } from '@/features/tasks/TaskFormSheet'
import { TaskItem } from '@/features/tasks/TaskItem'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { cn } from '@/lib/utils'

const emptyMessages: Record<QuickView, string> = {
  all: 'Chưa có công việc nào.',
  today: 'Hôm nay không có việc nào đến hạn.',
  upcoming: 'Không có việc nào đến hạn trong 7 ngày tới.',
  overdue: 'Không có việc quá hạn. Tốt lắm!',
}

export function TasksPage() {
  const online = useOnlineStatus()
  // Filters live in the URL: survive reloads, work with back/forward, and ?new=1 opens the form (Quick Create).
  const [params, setParams] = useSearchParams()
  const view = {
    quick: (params.get('view') ?? 'all') as QuickView,
    status: (params.get('status') ?? 'open') as StatusView,
    priority: (params.get('priority') ?? 'any') as TaskPriority | 'any',
    sort: (params.get('sort') ?? 'due_at') as SortView,
  }
  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      prev.set(key, value)
      return prev
    })

  // Recomputed per render so "today" never goes stale; built from day boundaries, so the key only changes when the day does.
  const query = useInfiniteQuery(tasksQuery(buildTaskFilters(view)))
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? []

  const [editing, setEditing] = useState<Task>()
  const creating = params.get('new') === '1'
  const sheetOpen = creating || editing !== undefined
  const closeSheet = () => {
    setEditing(undefined)
    if (creating)
      setParams((prev) => {
        prev.delete('new')
        return prev
      })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div role="tablist" className="flex w-max gap-1 rounded-xl border bg-card p-1">
          {quickViews.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view.quick === value}
              onClick={() => setParam('view', value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                view.quick === value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Trạng thái" value={view.status} options={statusViews} onChange={(v) => setParam('status', v)} />
        <FilterSelect
          label="Ưu tiên"
          value={view.priority}
          options={[{ value: 'any', label: 'Mọi ưu tiên' }, ...priorityOptions]}
          onChange={(v) => setParam('priority', v)}
        />
        <FilterSelect label="Sắp xếp" value={view.sort} options={sortViews} onChange={(v) => setParam('sort', v)} />
        <Button className="ml-auto" disabled={!online} onClick={() => setParam('new', '1')}>
          <Plus />
          Thêm
        </Button>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Đang tải">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError && tasks.length === 0 ? (
        <EmptyState
          icon={online ? RotateCw : WifiOff}
          message={online ? query.error.message : 'Bạn đang offline và chưa có dữ liệu lưu sẵn cho bộ lọc này.'}
          action={online ? <Button variant="outline" onClick={() => query.refetch()}>Thử lại</Button> : undefined}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          message={emptyMessages[view.quick]}
          action={
            online ? (
              <Button variant="outline" onClick={() => setParam('new', '1')}>
                <Plus />
                Thêm công việc
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} readOnly={!online} onOpen={() => setEditing(task)} />
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={query.isFetchingNextPage || !online}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm'}
            </Button>
          )}
        </>
      )}

      <TaskFormSheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()} task={editing} />
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger aria-label={label} className="data-[size=default]:h-9">
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
  )
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: typeof ListTodo
  message: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}

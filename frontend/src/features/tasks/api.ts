import { infiniteQueryOptions, useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, toQuery } from '@/lib/api-client'
import { saveOrQueue } from '@/offline/outbox'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'

export type Task = {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type TaskInput = Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'due_at'>

export type TaskFilters = {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  due_from?: string
  due_to?: string
  overdue?: boolean
  sort?: 'due_at' | 'priority' | 'created_at'
}

type TaskPage = { data: Task[]; meta: { current_page: number; last_page: number; total: number } }

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
}

export const tasksQuery = (filters: TaskFilters) =>
  infiniteQueryOptions({
    queryKey: taskKeys.list(filters),
    queryFn: ({ pageParam }) => api<TaskPage>(`/tasks?${toQuery({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })

const toInput = ({ title, description, priority, status, due_at }: Task): TaskInput => ({
  title,
  description,
  priority,
  status,
  due_at,
})

// Show an offline edit right away in every cached task list (infinite lists and the calendar's plain list).
function patchCachedTask(queryClient: QueryClient, id: string, patch: Partial<Task>) {
  queryClient.setQueriesData<InfiniteData<TaskPage> | Task[]>({ queryKey: taskKeys.all }, (data) => {
    const update = (t: Task) => (t.id === id ? { ...t, ...patch } : t)
    if (Array.isArray(data)) return data.map(update)
    if (data && 'pages' in data) return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map(update) })) }
    return data
  })
}

/**
 * Create/edit/complete all use the idempotent PUT /tasks/{uuid}, so they work offline (spec §6.2–6.3):
 * without a connection the write waits in the outbox and syncs later. Queued payloads carry
 * client_updated_at for last-write-wins; direct online saves don't need it.
 */
function putTask(id: string, input: TaskInput, created: boolean) {
  return saveOrQueue<{ data: Task }>(
    {
      entity: 'task',
      entityId: id,
      created,
      endpoint: `/tasks/${id}`,
      payload: { ...input, client_updated_at: new Date().toISOString() },
      label: `Công việc: ${input.title}`,
    },
    { ...input },
  )
}

export function useSaveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input, created }: { id: string; input: TaskInput; created: boolean }) => putTask(id, input, created),
    onSuccess: (result, { id, input }) => {
      if (result.queued) patchCachedTask(queryClient, id, input)
      else return queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

// Checkbox: flips instantly (optimistic); rolls back only if the server refuses. Offline it is queued and stays flipped.
export function useToggleTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => putTask(task.id, { ...toInput(task), status: task.status === 'completed' ? 'todo' : 'completed' }, false),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previous = queryClient.getQueriesData({ queryKey: taskKeys.all })
      patchCachedTask(queryClient, task.id, { status: task.status === 'completed' ? 'todo' : 'completed' })
      return { previous }
    },
    onError: (error, _task, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(error.message)
    },
    onSuccess: (result) => {
      if (!result.queued) return queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

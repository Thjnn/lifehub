import { infiniteQueryOptions, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

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

// Laravel reads arrays as status[]=a&status[]=b and booleans as 1/0.
function toQuery(params: Record<string, string | number | boolean | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach((item) => query.append(`${key}[]`, item))
    else query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  return query.toString()
}

export const tasksQuery = (filters: TaskFilters) =>
  infiniteQueryOptions({
    queryKey: taskKeys.list(filters),
    queryFn: ({ pageParam }) => api<TaskPage>(`/tasks?${toQuery({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })

// PUT is an idempotent upsert keyed by a client-made UUID — the same call works for create, edit and (Phase 7) offline sync.
const saveTask = (id: string, input: TaskInput) =>
  api<{ data: Task }>(`/tasks/${id}`, { method: 'PUT', body: input }).then((r) => r.data)

const toInput = ({ title, description, priority, status, due_at }: Task): TaskInput => ({
  title,
  description,
  priority,
  status,
  due_at,
})

export function useSaveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) => saveTask(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

// Checkbox: flips instantly (optimistic), rolls back if the server refuses.
export function useToggleTask() {
  const queryClient = useQueryClient()

  const setStatus = (id: string, status: TaskStatus) =>
    queryClient.setQueriesData<InfiniteData<TaskPage>>({ queryKey: taskKeys.all }, (data) =>
      data && 'pages' in data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map((t) => (t.id === id ? { ...t, status } : t)) })) }
        : data,
    )

  return useMutation({
    mutationFn: (task: Task) =>
      task.status === 'completed'
        ? saveTask(task.id, { ...toInput(task), status: 'todo' })
        : api<{ data: Task }>(`/tasks/${task.id}/complete`, { method: 'POST' }).then((r) => r.data),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previous = queryClient.getQueriesData({ queryKey: taskKeys.all })
      setStatus(task.id, task.status === 'completed' ? 'todo' : 'completed')
      return { previous }
    },
    onError: (error, _task, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

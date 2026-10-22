import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Task } from '@/features/tasks/api'
import { api, toQuery } from '@/lib/api-client'

export type EventType = 'study' | 'work' | 'workout' | 'rest' | 'personal'
export type EventStatus = 'scheduled' | 'completed' | 'cancelled'

// One concrete occurrence; series_* are the stored (first) times that the edit form changes.
export type Occurrence = {
  key: string
  id: number
  title: string
  description: string | null
  event_type: EventType
  status: EventStatus
  start_at: string
  end_at: string
  recurrence_rule: string | null
  series_start_at: string
  series_end_at: string
}

export type EventInput = {
  title: string
  description: string | null
  start_at: string
  end_at: string
  event_type: EventType
  status: EventStatus
  recurrence_rule: string | null
}

type SaveResponse = { data: Occurrence; meta: { overlaps: Occurrence[] } }

export const eventKeys = { all: ['events'] as const }

// Backend expands recurring events for exactly this range (spec §9.2).
export const eventsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['events', from, to],
    queryFn: async () => (await api<{ data: Occurrence[] }>(`/events?${toQuery({ from, to })}`)).data,
  })

// Tasks with a deadline in view, shown as separate items (not merged into events). Lives under ['tasks'] so task edits refresh it.
export const calendarTasksQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['tasks', 'calendar', from, to],
    queryFn: async () =>
      (
        await api<{ data: Task[] }>(
          `/tasks?${toQuery({ due_from: from, due_to: to, status: ['todo', 'in_progress', 'completed'], per_page: 100 })}`,
        )
      ).data,
  })

export function useSaveEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: EventInput }) =>
      api<SaveResponse>(id ? `/events/${id}` : '/events', { method: id ? 'PATCH' : 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

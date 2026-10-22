import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { searchMatch } from '@/lib/search'
import { saveOrQueue } from '@/offline/outbox'

export type Note = {
  id: string
  title: string | null
  body: string
  pinned: boolean
  task_id: string | null
  event_id: number | null
  created_at: string
  updated_at: string
}

export type NoteInput = Pick<Note, 'title' | 'body' | 'pinned' | 'task_id' | 'event_id'>

export const noteKeys = { all: ['notes'] as const }

// One request for everything: search and the per-task/event lists filter this cached list, so they work offline.
// ponytail: first 100 notes only (pinned, then most recently edited); add paging or server search past that.
export const notesQuery = queryOptions({
  queryKey: noteKeys.all,
  queryFn: () => api<{ data: Note[] }>('/notes?per_page=100').then((r) => r.data),
})

export const matchesSearch = (note: Pick<Note, 'title' | 'body'>, term: string) => searchMatch(`${note.title ?? ''}\n${note.body}`, term)

export function useSaveNote() {
  const queryClient = useQueryClient()
  return useMutation({
    // Same contract as tasks: idempotent PUT /notes/{uuid}; offline it waits in the outbox (spec §15.3).
    mutationFn: ({ id, input, created }: { id: string; input: NoteInput; created: boolean }) =>
      saveOrQueue<{ data: Note }>(
        {
          entity: 'note',
          entityId: id,
          created,
          endpoint: `/notes/${id}`,
          payload: { ...input, client_updated_at: new Date().toISOString() },
          label: `Ghi chú: ${input.title || input.body.slice(0, 40)}`,
        },
        { ...input },
      ),
    onSuccess: (result, { id, input }) => {
      if (!result.queued) return queryClient.invalidateQueries({ queryKey: noteKeys.all })
      // Offline: show the edit right away in the cached list.
      queryClient.setQueryData<Note[]>(noteKeys.all, (notes) =>
        notes?.some((n) => n.id === id) ? notes.map((n) => (n.id === id ? { ...n, ...input } : n)) : notes,
      )
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  })
}

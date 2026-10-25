import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// AI Coach is online-only (spec §6.2); these never go through the offline outbox.

export type Briefing = { date: string; content: string; generated_at: string | null }

export type Proposal = {
  id: number
  action_type: 'create_task' | 'create_event'
  payload: {
    title: string
    description?: string | null
    priority?: string
    due_at?: string | null
    start_at?: string
    end_at?: string
    event_type?: string
    location?: string | null
  }
  status: 'pending' | 'confirmed' | 'rejected' | 'expired'
  expires_at: string
}

export type ChatMessage = { id: number | string; role: 'user' | 'assistant'; content: string }

export const briefingQuery = queryOptions({
  queryKey: ['ai', 'briefing'],
  queryFn: async () => (await api<{ data: Briefing }>('/ai/briefing')).data,
  staleTime: 60 * 60_000, // one per day on the server; don't refetch on every visit
  retry: false, // a provider error shouldn't be hammered
})

export const latestConversationQuery = queryOptions({
  queryKey: ['ai', 'conversation'],
  queryFn: async () =>
    (await api<{ data: { conversation_id: number; messages: ChatMessage[]; proposals: Proposal[] } | null }>('/ai/conversations/latest')).data,
})

export function useRefreshBriefing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api<{ data: Briefing }>('/ai/briefing/refresh', { method: 'POST' })).data,
    onSuccess: (briefing) => queryClient.setQueryData(briefingQuery.queryKey, briefing),
  })
}

export function useSendMessage() {
  return useMutation({
    // page/month/date: asked from a page's floating assistant (features/ai/page-context.ts)
    mutationFn: async (input: { message: string; conversation_id?: number; page?: string; month?: string; date?: string }) =>
      (
        await api<{ data: { conversation_id: number; reply: string; proposals: Proposal[]; remaining_today: number } }>('/ai/chat', {
          method: 'POST',
          body: input,
        })
      ).data,
  })
}

export function useDecideProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'confirm' | 'reject' }) =>
      api<{ data: unknown }>(`/ai/proposals/${id}/${decision}`, { method: 'POST' }),
    onSuccess: (_data, { decision }) => {
      if (decision === 'confirm')
        return Promise.all([['tasks'], ['events'], ['dashboard']].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    },
  })
}

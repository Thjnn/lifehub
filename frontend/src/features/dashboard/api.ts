import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { meQuery, type City, type User } from '@/features/auth/api'
import type { Occurrence } from '@/features/calendar/api'
import type { AccountType } from '@/features/finance/api'
import type { Task } from '@/features/tasks/api'
import { fetchForecast } from '@/features/dashboard/open-meteo'
import { api } from '@/lib/api-client'

// GET /dashboard — one round trip for the home screen (spec §9.1); periods are in the user's timezone.
export type Dashboard = {
  today: string
  tasks: { due_today_total: number; due_today_done: number; overdue_count: number; overdue: Task[]; upcoming: Task[] }
  events_today: Occurrence[]
  finance: { month: string; income: string; expense: string; budget: { amount: string; remaining: string } | null }
  debts_due: { account_id: number; account_name: string; account_type: AccountType; due_date: string; amount: string; overdue: boolean }[]
}

export const dashboardQuery = queryOptions({
  queryKey: ['dashboard'],
  queryFn: async () => (await api<{ data: Dashboard }>('/dashboard')).data,
})

// Forecast straight from Open-Meteo in the browser (see open-meteo.ts); null city = none chosen yet.
export const weatherQuery = (city: City | null | undefined, timezone: string) =>
  queryOptions({
    queryKey: ['weather', city?.latitude, city?.longitude, timezone],
    queryFn: () => fetchForecast(city!, timezone),
    enabled: !!city,
    staleTime: 30 * 60_000, // forecasts change slowly; also keeps us far from the per-IP quota
    retry: 1,
  })

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { timezone?: string; city?: City | null }) => api<{ data: User }>('/me/settings', { method: 'PATCH', body: input }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(meQuery.queryKey, data)
      // Timezone moves "today"/"this month" boundaries. (The weather query is keyed by city/timezone, so it refetches itself.)
      return Promise.all([['dashboard'], ['budgets'], ['reports'], ['debts']].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    },
  })
}

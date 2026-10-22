import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { meQuery, type City, type User } from '@/features/auth/api'
import type { Occurrence } from '@/features/calendar/api'
import type { AccountType } from '@/features/finance/api'
import type { Task } from '@/features/tasks/api'
import { api, toQuery } from '@/lib/api-client'

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

export type Weather = {
  city: string
  current: { temperature: number; feels_like: number; weather_code: number; precipitation: number }
  hourly: { time: string; temperature: number; precipitation_probability: number; weather_code: number }[]
  daily: { date: string; weather_code: number; max: number; min: number; precipitation_probability: number }[]
}

// null = no city chosen yet, or the provider is unavailable
export const weatherQuery = queryOptions({
  queryKey: ['weather'],
  queryFn: async () => (await api<{ data: Weather | null }>('/weather')).data,
  staleTime: 30 * 60_000, // the backend caches an hour anyway
})

export type CityResult = City & { region: string | null; country: string | null }

export const searchCities = async (q: string) => (await api<{ data: CityResult[] }>(`/weather/cities?${toQuery({ q })}`)).data

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { timezone?: string; city?: City | null }) => api<{ data: User }>('/me/settings', { method: 'PATCH', body: input }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(meQuery.queryKey, data)
      // Timezone moves "today"/"this month" boundaries; the city changes the forecast.
      return Promise.all([['weather'], ['dashboard'], ['budgets'], ['reports'], ['debts']].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    },
  })
}

import { act } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

// Smoke test: mount the real app and visit every page with plausible API data. A page that crashes during
// render, effects or unmount lands in the router's error boundary — this catches it before users do.

const now = new Date()
const iso = (d: Date) => d.toISOString()
const day = iso(now).slice(0, 10)
const month = day.slice(0, 7)
const task = { id: '11111111-1111-4111-8111-111111111111', title: 'Ôn thi', description: null, priority: 'high', status: 'todo', due_at: iso(now), completed_at: null, created_at: iso(now), updated_at: iso(now) }
const occurrence = {
  key: '1@1', id: 1, title: 'Học nhóm', description: null, location: 'Thư viện', event_type: 'study', status: 'scheduled',
  start_at: iso(now), end_at: iso(new Date(now.getTime() + 3600_000)), recurrence_rule: null, series_start_at: iso(now), series_end_at: iso(now),
}
const account = { id: 1, name: 'Tiền mặt', account_type: 'cash', currency: 'VND', opening_balance: '0.00', balance: '100000.00', is_active: true, due_date: null, due_day: null, installment_amount: null, credit_limit: null }
const spaylater = { ...account, id: 2, name: 'SPayLater', account_type: 'liability', balance: '-4400000.00', due_day: 10, installment_amount: '2000000.00', credit_limit: '6000000.00' }
const category = { id: 1, name: 'Ăn uống', type: 'expense', icon: 'utensils', color: '#F87171', is_system: true }
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length } })

const responses: [RegExp, unknown][] = [
  [/\/me$/, { data: { id: 1, name: 'Nguyễn Minh', email: 'm@x.vn', settings: { timezone: 'Asia/Ho_Chi_Minh', locale: 'vi', currency: 'VND', theme: 'dark', preferences: {}, city: { name: 'Hà Nội', latitude: 21, longitude: 105 } } } }],
  [/\/dashboard$/, { data: { today: day, tasks: { due_today_total: 1, due_today_done: 0, overdue_count: 0, overdue: [], upcoming: [task] }, events_today: [occurrence], finance: { month, income: '0.00', expense: '45000.00', budget: { amount: '3000000.00', remaining: '2955000.00' } }, debts_due: [] } }],
  // Open-Meteo is called from the browser (raw Open-Meteo shape)
  [/api\.open-meteo\.com\/v1\/forecast/, { current: { temperature_2m: 27, apparent_temperature: 30, weather_code: 2, precipitation: 0 }, hourly: { time: [`${day}T15:00`], temperature_2m: [27], precipitation_probability: [70], weather_code: [61] }, daily: { time: [day], weather_code: [61], temperature_2m_max: [31], temperature_2m_min: [24], precipitation_probability_max: [70] } }],
  [/\/ai\/briefing$/, { data: { date: day, content: '- **Ôn thi** trước\n- Mang áo mưa', generated_at: iso(now) } }],
  [/\/ai\/conversations\/latest$/, { data: { conversation_id: 1, messages: [{ id: 1, role: 'user', content: 'Hi' }, { id: 2, role: 'assistant', content: 'Chào!' }], proposals: [] } }],
  [/\/tasks\?/, page([task])],
  [/\/events\?/, { data: [occurrence] }],
  [/\/debts\/due\?/, { data: [{ account_id: 2, account_name: 'SPayLater', account_type: 'liability', due_date: day, amount: '2000000.00', outstanding: '4400000.00', paid: false, overdue: false }] }],
  [/\/accounts$/, { data: [account, spaylater] }],
  [/\/categories$/, { data: [category] }],
  [/\/transactions\?/, page([{ id: '22222222-2222-4222-8222-222222222222', type: 'expense', account_id: 1, to_account_id: null, category_id: 1, amount: '45000.00', currency: 'VND', occurred_at: iso(now), description: null, created_at: iso(now), updated_at: iso(now) }])],
  [/\/budgets\?/, { data: [{ id: 1, category_id: null, period_start: `${month}-01`, period_end: `${month}-28`, amount: '3000000.00', spent: '45000.00', remaining: '2955000.00', percent: 2 }] }],
  [/\/nutrition\/profile$/, { data: { goal: 'cut', sex: 'male', birth_year: 2001, weight_kg: 70, height_cm: 175, workouts_per_week: 4, targets: { bmr: 1674, tdee: 2594, kcal: 2210, protein_g: 140 } } }],
  [/\/food-entries\?/, { data: [{ id: 1, eaten_at: iso(now), meal: 'lunch', food_id: 1, name: 'Phở bò', grams: 500, kcal: 450, protein_g: 25, carbs_g: 55, fat_g: 12, source: 'table' }], meta: { date: day, totals: { kcal: 450, protein_g: 25, carbs_g: 55, fat_g: 12 }, targets: null } }],
  [/\/notes\?/, page([{ id: '33333333-3333-4333-8333-333333333333', title: 'Ý tưởng', body: 'Ghi chú\nhai dòng', pinned: true, task_id: null, event_id: null, created_at: iso(now), updated_at: iso(now) }])],
  [/\/reports\/finance\?/, { data: { month, income: '0.00', expense: '45000.00', net: '-45000.00', previous: { income: '0.00', expense: '0.00' }, by_category: [{ category_id: 1, amount: '45000.00' }] } }],
]

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  localStorage.setItem('lifehub.token', 'test-token')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const match = responses.find(([re]) => re.test(url))
    return new Response(JSON.stringify(match ? match[1] : { data: null }), { status: match ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
  }))
  // Browser APIs jsdom lacks
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  // Newer Chrome returns a Promise from scroll methods (smooth scrolling). An effect that returns it hands React
  // a non-function "cleanup" → "l is not a function" on unmount (production crash, 2026-10-22).
  HTMLElement.prototype.scrollIntoView = function () {
    return Promise.resolve() as unknown as void
  }
})
afterAll(() => vi.unstubAllGlobals())

const pages = [
  '/app/dashboard', '/app/tasks', '/app/calendar', '/app/finance', '/app/finance/transactions', '/app/finance/accounts',
  '/app/finance/budgets', '/app/finance/reports', '/app/nutrition', '/app/notes', '/app/ai-coach', '/app/settings/profile', '/app/settings/preferences', '/app/settings/privacy', '/app/dashboard',
]

it('every page renders, runs its effects and unmounts without hitting the error boundary', async () => {
  const { router } = await import('@/app/router')
  const { queryClient } = await import('@/app/query-client')
  // React Router catches render/effect errors, logs them with console.error and clears them on the next navigation,
  // so the error boundary alone can't be relied on: any console.error fails the test.
  const logged: unknown[][] = []
  vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args))
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>))

  for (const path of pages) {
    await act(async () => {
      await router.navigate(path)
      await new Promise((r) => setTimeout(r, 50)) // let queries resolve and effects run
    })
    expect({ path, errors: router.state.errors }).toEqual({ path, errors: null })
    expect({ path, crashed: document.body.textContent?.includes('Unexpected Application Error') }).toEqual({ path, crashed: false })
  }

  await act(async () => root.unmount())
  expect(logged.map((args) => String(args[0]).slice(0, 200))).toEqual([])
}, 30_000)

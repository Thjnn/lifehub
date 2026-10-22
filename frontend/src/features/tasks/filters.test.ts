import { expect, it } from 'vitest'
import { buildTaskFilters } from '@/features/tasks/filters'

const now = new Date(2026, 9, 22, 15, 30)
const base = { quick: 'all', status: 'open', priority: 'any', sort: 'due_at' } as const

it('maps status and priority views to API filters', () => {
  expect(buildTaskFilters(base, now)).toEqual({ status: ['todo', 'in_progress'], priority: undefined, sort: 'due_at' })
  expect(buildTaskFilters({ ...base, status: 'any', priority: 'urgent' }, now)).toMatchObject({
    status: undefined,
    priority: ['urgent'],
  })
})

it('today covers the local day', () => {
  const f = buildTaskFilters({ ...base, quick: 'today' }, now)

  expect(new Date(f.due_from!)).toEqual(new Date(2026, 9, 22, 0, 0, 0, 0))
  expect(new Date(f.due_to!)).toEqual(new Date(2026, 9, 22, 23, 59, 59, 999))
})

it('upcoming covers today through day +7', () => {
  const f = buildTaskFilters({ ...base, quick: 'upcoming' }, now)

  expect(new Date(f.due_from!)).toEqual(new Date(2026, 9, 22))
  expect(new Date(f.due_to!)).toEqual(new Date(2026, 9, 29, 23, 59, 59, 999))
})

it('is stable within a day, so the query key does not change on every render', () => {
  for (const quick of ['all', 'today', 'upcoming', 'overdue'] as const) {
    expect(buildTaskFilters({ ...base, quick }, new Date(2026, 9, 22, 8))).toEqual(
      buildTaskFilters({ ...base, quick }, new Date(2026, 9, 22, 21)),
    )
  }
})

it('overdue is computed by the server', () => {
  expect(buildTaskFilters({ ...base, quick: 'overdue' }, now)).toMatchObject({ overdue: true })
})

it('isOverdue only counts open tasks past their deadline', async () => {
  const { isOverdue } = await import('@/features/tasks/labels')
  const past = new Date(2026, 9, 21).toISOString()

  expect(isOverdue({ status: 'todo', due_at: past }, now)).toBe(true)
  expect(isOverdue({ status: 'completed', due_at: past }, now)).toBe(false)
  expect(isOverdue({ status: 'todo', due_at: null }, now)).toBe(false)
  expect(isOverdue({ status: 'in_progress', due_at: new Date(2026, 9, 23).toISOString() }, now)).toBe(false)
})

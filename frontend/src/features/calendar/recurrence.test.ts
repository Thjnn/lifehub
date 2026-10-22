import { expect, it } from 'vitest'
import { buildRule, parseRule } from '@/features/calendar/recurrence'

it('builds RRULEs the backend accepts', () => {
  expect(buildRule('none', '')).toBeNull()
  expect(buildRule('weekly', '')).toBe('FREQ=WEEKLY')
  expect(buildRule('daily', '2026-12-31')).toMatch(/^FREQ=DAILY;UNTIL=\d{8}T\d{6}Z$/)
})

it('UNTIL is the end of the chosen local day', () => {
  const rule = buildRule('monthly', '2026-12-31')!
  const until = /UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(rule)!.slice(1).map(Number)
  const local = new Date(Date.UTC(until[0], until[1] - 1, until[2], until[3], until[4], until[5]))

  expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes()]).toEqual([
    2026, 11, 31, 23, 59,
  ])
})

it('round-trips through parseRule', () => {
  for (const [repeat, until] of [
    ['none', ''],
    ['daily', ''],
    ['weekly', '2026-11-30'],
    ['monthly', '2027-02-28'],
  ] as const) {
    expect(parseRule(buildRule(repeat, until))).toEqual({ repeat, until })
  }
})

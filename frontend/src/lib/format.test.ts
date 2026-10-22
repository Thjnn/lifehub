import { expect, it } from 'vitest'
import { formatDataTime, formatDue, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'

it('shows only the time for today and adds the date otherwise', () => {
  const now = new Date(2026, 9, 22, 18, 0)

  expect(formatDataTime(new Date(2026, 9, 22, 14, 32).getTime(), now)).toBe('14:32')
  expect(formatDataTime(new Date(2026, 9, 21, 9, 5).getTime(), now)).toBe('21/10 09:05')
})

it('labels deadlines relative to today', () => {
  const now = new Date(2026, 9, 22, 18, 0)
  const at = (...args: [number, number, number, number, number]) => new Date(...args).toISOString()

  expect(formatDue(at(2026, 9, 22, 14, 0), now)).toBe('Hôm nay 14:00')
  expect(formatDue(at(2026, 9, 23, 9, 0), now)).toBe('Ngày mai 09:00')
  expect(formatDue(at(2026, 9, 21, 18, 0), now)).toBe('Hôm qua 18:00')
  expect(formatDue(at(2026, 9, 25, 14, 0), now)).toBe('25/10 14:00')
  expect(formatDue(at(2027, 0, 5, 8, 0), now)).toBe('05/01/2027 08:00')
})

it('round-trips datetime-local values', () => {
  expect(toDateTimeLocal(null)).toBe('')
  expect(fromDateTimeLocal('')).toBeNull()
  const iso = fromDateTimeLocal('2026-10-25T14:00')!
  expect(toDateTimeLocal(iso)).toBe('2026-10-25T14:00')
})

import { expect, it } from 'vitest'
import { formatDataTime } from '@/lib/format'

it('shows only the time for today and adds the date otherwise', () => {
  const now = new Date(2026, 9, 22, 18, 0)

  expect(formatDataTime(new Date(2026, 9, 22, 14, 32).getTime(), now)).toBe('14:32')
  expect(formatDataTime(new Date(2026, 9, 21, 9, 5).getTime(), now)).toBe('21/10 09:05')
})

import { expect, it } from 'vitest'
import { weatherLabel } from '@/features/dashboard/weather'

it('maps WMO codes to Vietnamese labels', () => {
  expect(weatherLabel(0)).toBe('Trời quang')
  expect(weatherLabel(2)).toBe('Ít mây')
  expect(weatherLabel(61)).toBe('Mưa')
  expect(weatherLabel(81)).toBe('Mưa rào')
  expect(weatherLabel(95)).toBe('Dông')
})

import { expect, it } from 'vitest'
import { formatVnd, groupDigits, parseVndInput, sumMoney } from '@/lib/money'

it('formats VND', () => {
  // Intl may use a non-breaking space before ₫
  expect(formatVnd('1500000.00').replace(/\s/g, ' ')).toBe('1.500.000 ₫')
  expect(groupDigits('1500000')).toBe('1.500.000')
  expect(groupDigits('')).toBe('')
})

it('parses typed amounts to digits', () => {
  expect(parseVndInput('1.500.000 đ')).toBe('1500000')
  expect(parseVndInput('000123')).toBe('123')
  expect(parseVndInput('0')).toBe('0')
  expect(parseVndInput('abc')).toBe('')
})

it('sums exactly, unlike floats', () => {
  expect(0.1 + 0.2).not.toBe(0.3)
  expect(sumMoney(['0.10', '0.20'])).toBe('0.30')
  expect(sumMoney(['1454999.50', '7500000.00', '-200.25'])).toBe('8954799.25')
  expect(sumMoney([])).toBe('0.00')
})

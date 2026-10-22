import { expect, it } from 'vitest'
import { budgetStatus, percentChange } from '@/features/finance/report-math'

it('computes % change vs the previous month', () => {
  expect(percentChange('1200000.00', '1000000.00')).toBe(20)
  expect(percentChange('750000.00', '1000000.00')).toBe(-25)
  expect(percentChange('500.00', '0.00')).toBeNull() // nothing to compare
})

it('classifies budget usage', () => {
  expect(budgetStatus({ percent: 79 })).toBe('ok')
  expect(budgetStatus({ percent: 80 })).toBe('warning')
  expect(budgetStatus({ percent: 100 })).toBe('warning')
  expect(budgetStatus({ percent: 101 })).toBe('over')
})

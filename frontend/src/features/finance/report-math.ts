import type { Budget } from '@/features/finance/api'

// % change for display only (rounded); null when there is no base to compare against.
export function percentChange(current: string, previous: string): number | null {
  const prev = Number(previous)
  if (prev === 0) return null
  return Math.round(((Number(current) - prev) / prev) * 100)
}

// Spec §9.4: warn above 80%, over budget above 100%.
export type BudgetStatus = 'ok' | 'warning' | 'over'
export const budgetStatus = (b: Pick<Budget, 'percent'>): BudgetStatus =>
  b.percent > 100 ? 'over' : b.percent >= 80 ? 'warning' : 'ok'

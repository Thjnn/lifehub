import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, toQuery } from '@/lib/api-client'

// liability = I owe (SPayLater, credit card, borrowed; balance negative); receivable = owed to me (balance positive)
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'liability' | 'receivable'
export const isDebtType = (type: AccountType) => type === 'liability' || type === 'receivable'
export type TransactionType = 'income' | 'expense' | 'transfer'

// Money fields are decimal strings ("150000.00") — see lib/money.ts.
export type Account = {
  id: number
  name: string
  account_type: AccountType
  currency: string
  opening_balance: string
  balance: string
  is_active: boolean
  // Repayment schedule (debt accounts only): one date, or a day of every month
  due_date: string | null
  due_day: number | null
  installment_amount: string | null
  credit_limit: string | null // liability only (SPayLater, credit card)
}

export type Category = {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
  color: string | null
  is_system: boolean
}

export type Transaction = {
  id: string
  type: TransactionType
  account_id: number
  to_account_id: number | null
  category_id: number | null
  amount: string
  currency: string
  occurred_at: string
  description: string | null
  created_at: string
  updated_at: string
}

export type TransactionInput = Pick<
  Transaction,
  'type' | 'account_id' | 'to_account_id' | 'category_id' | 'amount' | 'occurred_at' | 'description'
>

export type TransactionFilters = { month: string; type?: TransactionType; account_id?: number; category_id?: number }

type TransactionPage = { data: Transaction[]; meta: { current_page: number; last_page: number } }

export const financeKeys = {
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  transactions: ['transactions'] as const,
  budgets: ['budgets'] as const,
  reports: ['reports'] as const,
  debts: ['debts'] as const,
}

export const accountsQuery = queryOptions({
  queryKey: financeKeys.accounts,
  queryFn: async () => (await api<{ data: Account[] }>('/accounts')).data,
})

export const categoriesQuery = queryOptions({
  queryKey: financeKeys.categories,
  queryFn: async () => (await api<{ data: Category[] }>('/categories')).data,
  staleTime: 10 * 60_000, // rarely changes
})

export const transactionsQuery = (filters: TransactionFilters) =>
  infiniteQueryOptions({
    queryKey: [...financeKeys.transactions, filters],
    queryFn: ({ pageParam }) => api<TransactionPage>(`/transactions?${toQuery({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })

// Any money movement changes balances, budget spending and reports, so they refresh together.
function useInvalidateMoney() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [financeKeys.transactions, financeKeys.accounts, financeKeys.budgets, financeKeys.reports, financeKeys.debts].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
}

export function useSaveTransaction() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionInput }) =>
      api<{ data: Transaction }>(`/transactions/${id}`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export type AccountInput = Pick<
  Account,
  'name' | 'account_type' | 'opening_balance' | 'due_date' | 'due_day' | 'installment_amount' | 'credit_limit'
> & {
  is_active?: boolean
}

export function useSaveAccount() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AccountInput }) =>
      api<{ data: Account }>(id ? `/accounts/${id}` : '/accounts', { method: id ? 'PATCH' : 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.accounts }),
  })
}

export function useSaveCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: Partial<Pick<Category, 'name' | 'type' | 'color'>> }) =>
      api<{ data: Category }>(id ? `/categories/${id}` : '/categories', { method: id ? 'PATCH' : 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.categories }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.categories }),
  })
}

// spent/remaining are computed by the API for the budget's month; percent is a whole number (110 = over by 10%).
export type Budget = {
  id: number
  category_id: number | null // null = overall budget
  period_start: string
  period_end: string
  amount: string
  spent: string
  remaining: string
  percent: number
}

export const budgetsQuery = (month: string) =>
  queryOptions({
    queryKey: [...financeKeys.budgets, month],
    queryFn: async () => (await api<{ data: Budget[] }>(`/budgets?month=${month}`)).data,
  })

export function useSaveBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: { month?: string; category_id?: number | null; amount: string } }) =>
      api<{ data: Budget }>(id ? `/budgets/${id}` : '/budgets', { method: id ? 'PATCH' : 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.budgets }),
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.budgets }),
  })
}

export type FinanceReport = {
  month: string
  income: string
  expense: string
  net: string
  previous: { income: string; expense: string }
  by_category: { category_id: number | null; amount: string }[]
}

export const reportQuery = (month: string) =>
  queryOptions({
    queryKey: [...financeKeys.reports, month],
    queryFn: async () => (await api<{ data: FinanceReport }>(`/reports/finance?month=${month}`)).data,
  })

// A repayment due on a local date (YYYY-MM-DD); amount is this instalment, outstanding the whole remaining debt.
export type DueItem = {
  account_id: number
  account_name: string
  account_type: 'liability' | 'receivable'
  due_date: string
  amount: string
  outstanding: string
  paid: boolean
  overdue: boolean
}

export const debtsDueQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: [...financeKeys.debts, from, to],
    queryFn: async () => (await api<{ data: DueItem[] }>(`/debts/due?${toQuery({ from, to })}`)).data,
  })

import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, toQuery } from '@/lib/api-client'

export type AccountType = 'cash' | 'bank' | 'ewallet'
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

// Any money movement changes balances, so transactions and accounts refresh together.
function useInvalidateMoney() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts }),
    ])
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

export type AccountInput = Pick<Account, 'name' | 'account_type' | 'opening_balance'> & { is_active?: boolean }

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

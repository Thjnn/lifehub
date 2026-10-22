import type { AccountType, TransactionType } from '@/features/finance/api'

export const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank', label: 'Ngân hàng' },
  { value: 'ewallet', label: 'Ví điện tử' },
  { value: 'liability', label: 'Nợ / Trả sau' },
  { value: 'receivable', label: 'Cho vay' },
]

export const transactionTypeOptions: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'transfer', label: 'Chuyển khoản' },
]

// Palette for custom categories (spec §7 tokens + a few neighbours).
export const categoryColors = ['#5B8CFF', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#38BDF8', '#F472B6', '#9CA3AF']

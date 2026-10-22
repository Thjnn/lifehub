import { Banknote, Landmark, Smartphone, type LucideIcon } from 'lucide-react'
import type { AccountType, TransactionType } from '@/features/finance/api'

export const accountTypeOptions: { value: AccountType; label: string; icon: LucideIcon }[] = [
  { value: 'cash', label: 'Tiền mặt', icon: Banknote },
  { value: 'bank', label: 'Ngân hàng', icon: Landmark },
  { value: 'ewallet', label: 'Ví điện tử', icon: Smartphone },
]

export const accountTypeIcon = (type: AccountType) => accountTypeOptions.find((o) => o.value === type)!.icon

export const transactionTypeOptions: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'transfer', label: 'Chuyển khoản' },
]

// Palette for custom categories (spec §7 tokens + a few neighbours).
export const categoryColors = ['#5B8CFF', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#38BDF8', '#F472B6', '#9CA3AF']

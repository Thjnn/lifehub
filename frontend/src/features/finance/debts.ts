import { isDebtType, type Account, type DueItem } from '@/features/finance/api'
import type { TransactionDefaults } from '@/features/finance/TransactionFormSheet'

// Remaining debt as a positive decimal string ("600000.00"), or null when cleared.
export function outstanding(account: Pick<Account, 'account_type' | 'balance'>): string | null {
  const owed = account.account_type === 'liability' ? account.balance.replace(/^-/, '') : account.balance
  const cleared =
    account.account_type === 'liability' ? !account.balance.startsWith('-') : account.balance.startsWith('-')
  return cleared || Number(owed) === 0 ? null : owed
}

/**
 * Prefill the transfer that settles one instalment:
 * - liability: from my first money account INTO the debt (paying is not spending again);
 * - receivable: OUT of the debt into my first money account (getting money back is not income).
 */
export function settleDefaults(
  debt: Pick<Account, 'id' | 'name' | 'account_type'>,
  amount: string,
  accounts: Account[],
): TransactionDefaults {
  const wallet = accounts.find((a) => a.is_active && !isDebtType(a.account_type))?.id
  const whole = amount.split('.')[0]

  return debt.account_type === 'liability'
    ? { type: 'transfer', account_id: wallet, to_account_id: debt.id, amount: whole, description: `Trả ${debt.name}` }
    : { type: 'transfer', account_id: debt.id, to_account_id: wallet, amount: whole, description: `${debt.name} trả tiền` }
}

export const dueItemTitle = (item: Pick<DueItem, 'account_type' | 'account_name'>) =>
  item.account_type === 'liability' ? `Trả ${item.account_name}` : `Thu nợ: ${item.account_name}`

import { expect, it } from 'vitest'
import type { Account } from '@/features/finance/api'
import { outstanding, settleDefaults } from '@/features/finance/debts'

const account = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'X',
  account_type: 'cash',
  currency: 'VND',
  opening_balance: '0.00',
  balance: '0.00',
  is_active: true,
  due_date: null,
  due_day: null,
  installment_amount: null,
  ...over,
})

it('reads what is still owed', () => {
  expect(outstanding({ account_type: 'liability', balance: '-600000.00' })).toBe('600000.00')
  expect(outstanding({ account_type: 'liability', balance: '0.00' })).toBeNull()
  expect(outstanding({ account_type: 'receivable', balance: '500000.00' })).toBe('500000.00')
  expect(outstanding({ account_type: 'receivable', balance: '0.00' })).toBeNull()
})

it('settling a liability transfers from a money account into the debt', () => {
  const accounts = [
    account({ id: 9, account_type: 'liability', name: 'SPayLater' }),
    account({ id: 2, account_type: 'bank', is_active: false }),
    account({ id: 3, account_type: 'ewallet' }),
  ]

  expect(settleDefaults(accounts[0], '300000.00', accounts)).toEqual({
    type: 'transfer',
    account_id: 3, // first ACTIVE non-debt account
    to_account_id: 9,
    amount: '300000',
    description: 'Trả SPayLater',
  })
})

it('collecting a receivable transfers out of the debt', () => {
  const lan = account({ id: 7, account_type: 'receivable', name: 'Lan mượn' })

  expect(settleDefaults(lan, '500000.00', [lan, account({ id: 1, account_type: 'cash' })])).toMatchObject({
    account_id: 7,
    to_account_id: 1,
  })
})

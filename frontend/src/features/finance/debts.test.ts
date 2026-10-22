import { expect, it } from 'vitest'
import type { Account } from '@/features/finance/api'
import { creditLine, outstanding, settleDefaults } from '@/features/finance/debts'

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
  credit_limit: null,
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

it('computes the credit line like SPayLater shows it', () => {
  // Limit 6,000,000, owing 4,400,000 → 1,600,000 available, 73% used
  expect(creditLine(account({ account_type: 'liability', balance: '-4400000.00', credit_limit: '6000000.00' }))).toEqual({
    limit: '6000000.00',
    available: '1600000.00',
    usedPercent: 73,
  })
  // Over the limit: available goes negative
  expect(creditLine(account({ account_type: 'liability', balance: '-6500000.00', credit_limit: '6000000.00' }))?.available).toBe('-500000.00')
  expect(creditLine(account({ account_type: 'liability', balance: '-100.00' }))).toBeNull() // no limit set
  expect(creditLine(account({ account_type: 'bank', credit_limit: '1.00' }))).toBeNull()
})

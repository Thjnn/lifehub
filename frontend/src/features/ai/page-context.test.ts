import { describe, expect, it } from 'vitest'
import { pageContextFor } from '@/features/ai/page-context'

describe('pageContextFor', () => {
  it('names the page and passes the month or day it shows', () => {
    expect(pageContextFor('/app/finance/budgets', '?month=2026-09')).toMatchObject({ page: 'finance.budgets', month: '2026-09' })
    expect(pageContextFor('/app/nutrition', '?date=2026-10-20')).toMatchObject({ page: 'nutrition', date: '2026-10-20' })
    expect(pageContextFor('/app/nutrition/plan/', '?week=2026-10-19')).toMatchObject({ page: 'nutrition.plan', date: '2026-10-19' })
  })

  it('drops malformed params so the server falls back to today / this month', () => {
    const context = pageContextFor('/app/finance/reports', '?month=09-2026&date=hôm-nay')
    expect(context).not.toHaveProperty('month')
    expect(context).not.toHaveProperty('date')
  })

  it('has no assistant on AI Coach, notes or settings', () => {
    for (const path of ['/app/ai-coach', '/app/notes', '/app/settings/profile']) expect(pageContextFor(path, '')).toBeNull()
  })
})

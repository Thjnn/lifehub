import { afterEach, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { queryClient } from '@/app/query-client'

afterEach(() => onlineManager.setOnline(true))

// Regression guard: with TanStack's default networkMode ('online') an offline mutation never starts,
// so the outbox would never receive it and the form would spin forever.
it('runs mutations immediately even while offline', async () => {
  onlineManager.setOnline(false)
  const mutationFn = vi.fn().mockResolvedValue('queued')

  const result = await queryClient.getMutationCache().build(queryClient, { mutationFn }).execute(undefined)

  expect(mutationFn).toHaveBeenCalledOnce()
  expect(result).toBe('queued')
})

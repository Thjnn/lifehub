import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// In-memory stand-in for IndexedDB (jsdom has none).
const idb = vi.hoisted(() => new Map<string, unknown>())
const idbState = vi.hoisted(() => ({ broken: false }))
vi.mock('idb-keyval', () => ({
  get: async (key: string) => {
    if (idbState.broken) throw new Error('IndexedDB unavailable')
    return idb.get(key)
  },
  set: async (key: string, value: unknown) => void idb.set(key, value),
  del: async (key: string) => void idb.delete(key),
}))

const { clearOfflineData, queryClient, restoreOfflineCache } = await import('@/app/query-client')
const { requireAuth } = await import('@/app/router')
const { tokenStore } = await import('@/lib/api-client')

const CACHE_KEY = 'lifehub.query-cache'
const storedQueryKeys = () => {
  const raw = idb.get(CACHE_KEY) as string | undefined
  return raw ? JSON.parse(raw).clientState.queries.map((q: { queryKey: unknown }) => q.queryKey) : []
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('persists fetched data, restores it, and wipes it on clearOfflineData', async () => {
  await restoreOfflineCache()
  queryClient.setQueryData(['me'], { id: 1, name: 'Minh' })
  await vi.advanceTimersByTimeAsync(1500) // persister throttles writes

  expect(storedQueryKeys()).toEqual([['me']])

  // Simulate a reload: memory is empty, IndexedDB still holds the snapshot.
  const snapshot = idb.get(CACHE_KEY)
  queryClient.clear()
  await vi.advanceTimersByTimeAsync(1500)
  idb.set(CACHE_KEY, snapshot)
  await restoreOfflineCache()
  expect(queryClient.getQueryData(['me'])).toEqual({ id: 1, name: 'Minh' })

  await clearOfflineData()
  await vi.advanceTimersByTimeAsync(1500)
  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(storedQueryKeys()).toEqual([])
})

it('still starts when IndexedDB is unavailable', async () => {
  idb.set(CACHE_KEY, 'something')
  idbState.broken = true

  await expect(restoreOfflineCache()).resolves.toBeUndefined()
  idbState.broken = false
})

it('does not wait for the network when offline', async () => {
  tokenStore.set('token')
  vi.stubGlobal('navigator', { ...navigator, onLine: false })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  await expect(requireAuth()).resolves.toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('redirects to login without a token', async () => {
  const result = await requireAuth()

  expect(result).toBeInstanceOf(Response)
  expect((result as Response).headers.get('Location')).toBe('/login')
})

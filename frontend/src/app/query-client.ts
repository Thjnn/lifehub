import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { ApiError } from '@/lib/api-client'

// Offline level 2 (spec §6.2): the last fetched data is kept in IndexedDB and shown when offline.
const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

const isClientError = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Token expired or revoked mid-session → back to login (full reload also drops in-memory state).
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401 && window.location.pathname.startsWith('/app')) {
        window.location.replace('/login')
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Must be >= OFFLINE_MAX_AGE, otherwise unused queries are garbage-collected before they can be persisted.
      gcTime: OFFLINE_MAX_AGE,
      // 4xx won't fix itself; network errors and 5xx (cold start) get two more tries.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'lifehub.query-cache',
})

// Loads the IndexedDB cache into queryClient, then keeps saving it. Await before the first render so
// route loaders (requireAuth) see the cached user instead of hitting the network.
export function restoreOfflineCache() {
  const [, restored] = persistQueryClient({ queryClient, persister, maxAge: OFFLINE_MAX_AGE })
  // IndexedDB can be missing or broken (some private modes): run online-only rather than not render at all.
  return restored.catch(() => {})
}

// Logout and sign-in both call this, so one user's data never shows up for the next user on the device (spec §5).
export async function clearOfflineData() {
  queryClient.clear()
  await persister.removeClient()
  // Phase 7: also clear the Dexie outbox here.
}

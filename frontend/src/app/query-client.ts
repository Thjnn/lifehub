import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

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
      // 4xx won't fix itself; network errors and 5xx (cold start) get two more tries.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
    },
  },
})

import { queryOptions } from '@tanstack/react-query'
import { clearOfflineData, queryClient } from '@/app/query-client'
import { api, tokenStore } from '@/lib/api-client'

export type User = {
  id: number
  name: string
  email: string
  settings: {
    timezone: string
    locale: string
    currency: string
    theme: string
    preferences: Record<string, unknown>
  }
}

type AuthResponse = { data: { token: string; user: User } }
type MessageResponse = { message: string }

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await api<{ data: User }>('/me')).data,
  staleTime: 5 * 60_000,
})

// Token name shown per device (spec §5), e.g. "Chrome trên Android".
function deviceName() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Trình duyệt'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'thiết bị khác'
  return `${browser} trên ${os}`
}

async function startSession(path: string, body: Record<string, string>) {
  const { data } = await api<AuthResponse>(path, { method: 'POST', body: { ...body, device_name: deviceName() } })
  // A previous user's token may have expired without a logout — drop their cached data first.
  await clearOfflineData()
  tokenStore.set(data.token)
  queryClient.setQueryData(meQuery.queryKey, data.user)
}

export const login = (values: { email: string; password: string }) => startSession('/auth/login', values)

export const register = (values: { name: string; email: string; password: string; password_confirmation: string }) =>
  startSession('/auth/register', values)

export const forgotPassword = (values: { email: string }) =>
  api<MessageResponse>('/auth/forgot-password', { method: 'POST', body: values })

export const resetPassword = (values: { token: string; email: string; password: string; password_confirmation: string }) =>
  api<MessageResponse>('/auth/reset-password', { method: 'POST', body: values })

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch {
    // Token may already be expired or the server unreachable — still sign out locally.
  } finally {
    tokenStore.clear()
    await clearOfflineData()
  }
}

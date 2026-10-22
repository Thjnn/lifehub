const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'lifehub.token'
const SLOW_REQUEST_MS = 3000

// Sanctum token in localStorage (spec §5): accepted XSS risk, offset by strict CSP and 30-day expiry.
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

// Render free tier sleeps; the first request can take 30–60s (spec §3.4). Requests slower than 3s flip this on.
let slowRequests = 0
const listeners = new Set<() => void>()
export const serverWaking = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => slowRequests > 0,
}
function trackSlow(delta: 1 | -1) {
  slowRequests += delta
  listeners.forEach((listener) => listener())
}

// Laravel reads arrays as status[]=a&status[]=b and booleans as 1/0.
export function toQuery(params: Record<string, string | number | boolean | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach((item) => query.append(`${key}[]`, item))
    else query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  return query.toString()
}

function messageFor(status: number, serverMessage?: string) {
  if (status === 429) return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'
  if (status >= 500) return 'Máy chủ đang gặp lỗi, vui lòng thử lại sau.'
  return serverMessage || 'Có lỗi xảy ra, vui lòng thử lại.'
}

export async function api<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let slow = false
  const timer = setTimeout(() => {
    slow = true
    trackSlow(1)
  }, SLOW_REQUEST_MS)

  let res: Response
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  } finally {
    clearTimeout(timer)
    if (slow) trackSlow(-1)
  }

  // Expired or revoked token: drop it. Redirecting is the router's / query cache's job.
  if (res.status === 401 && token) tokenStore.clear()

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, messageFor(res.status, data.message), data.errors ?? {})
  }

  return res.status === 204 ? (undefined as T) : res.json()
}

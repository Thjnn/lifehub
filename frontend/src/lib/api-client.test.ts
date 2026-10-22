import { afterEach, expect, it, vi } from 'vitest'
import { api, ApiError, tokenStore } from '@/lib/api-client'

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('sends the bearer token and a JSON body', async () => {
  tokenStore.set('abc')
  const fetchMock = mockFetch(200, { ok: true })

  await expect(api('/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true })

  const [, init] = fetchMock.mock.calls[0]
  expect(init.headers.Authorization).toBe('Bearer abc')
  expect(init.headers['Content-Type']).toBe('application/json')
  expect(init.body).toBe('{"a":1}')
})

it('clears the token on 401', async () => {
  tokenStore.set('expired')
  mockFetch(401, { message: 'Unauthenticated.' })

  await expect(api('/me')).rejects.toMatchObject({ status: 401 })
  expect(tokenStore.get()).toBeNull()
})

it('exposes Laravel 422 field errors', async () => {
  mockFetch(422, { message: 'Invalid', errors: { email: ['Email này đã được đăng ký.'] } })

  const error = (await api('/auth/register', { method: 'POST', body: {} }).catch((e) => e)) as ApiError

  expect(error).toBeInstanceOf(ApiError)
  expect(error.errors.email).toEqual(['Email này đã được đăng ký.'])
})

it('turns a network failure into a friendly ApiError', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  await expect(api('/me')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Không kết nối') })
})

it('returns undefined for 204', async () => {
  mockFetch(204)

  await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
})

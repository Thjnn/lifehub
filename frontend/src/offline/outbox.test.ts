import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  api: apiMock,
}))

const { ApiError, tokenStore } = await import('@/lib/api-client')
const { db } = await import('@/offline/db')
const { enqueue, retryItem, saveOrQueue, syncOutbox } = await import('@/offline/outbox')

const task = (id: string, title: string) => ({
  entity: 'task' as const,
  entityId: id,
  created: false,
  endpoint: `/tasks/${id}`,
  payload: { title, client_updated_at: '2026-10-22T10:00:00Z' },
  label: title,
})

let online = false
beforeEach(async () => {
  online = false // queue only; each test decides when the connection "comes back"
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  tokenStore.set('token')
  apiMock.mockReset()
  await db.outbox.clear()
})
afterEach(() => vi.restoreAllMocks())

it('collapses offline edits of one record into a single entry, keeping its place and created flag', async () => {
  await enqueue({ ...task('a', 'Tạo offline'), created: true })
  await enqueue(task('b', 'Khác'))
  await enqueue(task('a', 'Sửa lần 2'))

  const items = await db.outbox.orderBy('id').toArray()
  expect(items.map((i) => [i.entityId, i.label, i.created])).toEqual([
    ['a', 'Sửa lần 2', true],
    ['b', 'Khác', false],
  ])
})

it('replays in order and removes what the server accepted', async () => {
  await enqueue(task('a', '1'))
  await enqueue(task('b', '2'))
  online = true
  apiMock.mockResolvedValue({})

  await syncOutbox()

  expect(apiMock.mock.calls.map((c) => c[0])).toEqual(['/tasks/a', '/tasks/b'])
  expect(await db.outbox.count()).toBe(0)
})

it('stops at a network error and keeps the rest in order', async () => {
  await enqueue(task('a', '1'))
  await enqueue(task('b', '2'))
  online = true
  apiMock.mockRejectedValueOnce(new ApiError(0, 'offline'))

  await syncOutbox()

  expect(apiMock).toHaveBeenCalledTimes(1)
  expect((await db.outbox.toArray()).map((i) => [i.entityId, i.status, i.attempts])).toEqual([
    ['a', 'pending', 1],
    ['b', 'pending', 0],
  ])
})

it('never drops a rejected write: 422 and 409 are kept as failed, the queue moves on', async () => {
  await enqueue(task('a', 'invalid'))
  await enqueue(task('b', 'conflict'))
  await enqueue(task('c', 'ok'))
  online = true
  apiMock
    .mockRejectedValueOnce(new ApiError(422, 'Invalid', { title: ['Vui lòng nhập tên'] }))
    .mockRejectedValueOnce(new ApiError(409, 'Đã sửa ở nơi khác'))
    .mockResolvedValueOnce({})

  await syncOutbox()

  const items = await db.outbox.orderBy('id').toArray()
  expect(items.map((i) => [i.entityId, i.status, i.conflict])).toEqual([
    ['a', 'failed', false],
    ['b', 'failed', true],
  ])
  expect(items[0].error).toContain('Vui lòng nhập tên')
})

it('overwrite resends without the last-write-wins timestamp', async () => {
  await enqueue(task('b', 'conflict'))
  online = true
  apiMock.mockRejectedValueOnce(new ApiError(409, 'conflict'))
  await syncOutbox()
  apiMock.mockResolvedValueOnce({})

  await retryItem((await db.outbox.toArray())[0], { overwrite: true })

  expect(apiMock.mock.calls[1][1].body).toEqual({ title: 'conflict' })
  expect(await db.outbox.count()).toBe(0)
})

it('saveOrQueue: online saves directly, falls back to the queue when the connection drops', async () => {
  online = true
  apiMock.mockResolvedValueOnce({ data: 'saved' })
  expect(await saveOrQueue(task('a', 'x'))).toEqual({ queued: false, data: { data: 'saved' } })

  apiMock.mockRejectedValueOnce(new ApiError(0, 'Failed to fetch')).mockRejectedValue(new ApiError(0, 'still offline'))
  expect(await saveOrQueue(task('b', 'y'))).toEqual({ queued: true })
  expect(await db.outbox.count()).toBe(1)

  // Validation errors are not queued: they belong in the form
  apiMock.mockReset().mockRejectedValueOnce(new ApiError(422, 'Invalid'))
  await expect(saveOrQueue(task('c', 'z'))).rejects.toMatchObject({ status: 422 })
})

import { useLiveQuery } from 'dexie-react-hooks'
import { queryClient } from '@/app/query-client'
import { api, ApiError, tokenStore } from '@/lib/api-client'
import { db, type OutboxItem } from '@/offline/db'

type NewItem = Pick<OutboxItem, 'entity' | 'entityId' | 'created' | 'endpoint' | 'payload' | 'label'>

/**
 * Queue a write. Several offline edits of the same record collapse into one entry (the latest full payload),
 * keeping the original position and its "created" flag.
 */
export async function enqueue(item: NewItem) {
  await db.transaction('rw', db.outbox, async () => {
    const existing = await db.outbox.where('entityId').equals(item.entityId).first()
    if (existing) {
      await db.outbox.update(existing.id!, {
        ...item,
        created: existing.created || item.created,
        status: 'pending',
        error: undefined,
        conflict: false,
      })
    } else {
      await db.outbox.add({ ...item, attempts: 0, status: 'pending' })
    }
  })
  void syncOutbox()
}

/**
 * Save now when possible, otherwise queue. Online validation errors (422) still reach the form.
 * A record that already waits in the outbox is queued too, so its writes stay in order.
 */
export async function saveOrQueue<T>(item: NewItem, onlinePayload: Record<string, unknown> = item.payload) {
  const waiting = await db.outbox.where('entityId').equals(item.entityId).count()
  if (navigator.onLine && waiting === 0) {
    try {
      return { queued: false as const, data: await api<T>(item.endpoint, { method: 'PUT', body: onlinePayload }) }
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 0)) throw error // only "no connection" falls back to the queue
    }
  }
  await enqueue(item)
  return { queued: true as const }
}

let running: Promise<void> | null = null

// Replay pending writes one by one, in order. Single flight: concurrent calls share the same run.
export function syncOutbox(): Promise<void> {
  running ??= replay().finally(() => {
    running = null
  })
  return running
}

async function replay() {
  if (!navigator.onLine || !tokenStore.get()) return
  const items = await db.outbox.where('status').equals('pending').sortBy('id')
  let changed = false

  for (const item of items) {
    try {
      await api(item.endpoint, { method: 'PUT', body: item.payload })
      await db.outbox.delete(item.id!)
      changed = true
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      // Rejected by the server (validation, conflict, deleted, forbidden): never dropped silently — the user decides.
      if (status >= 400 && status < 500 && status !== 401 && status !== 429) {
        const fields = error instanceof ApiError ? Object.values(error.errors).flat() : []
        await db.outbox.update(item.id!, {
          status: 'failed',
          error: [error instanceof Error ? error.message : 'Lỗi', ...fields].join(' '),
          conflict: status === 409,
          attempts: item.attempts + 1,
        })
        changed = true
        continue
      }
      // Offline again, server down / waking, expired login, rate limit: stop and keep the order; retry later.
      await db.outbox.update(item.id!, { attempts: item.attempts + 1 })
      break
    }
  }

  if (changed) {
    await Promise.all(
      [['tasks'], ['transactions'], ['accounts'], ['budgets'], ['reports'], ['debts'], ['dashboard']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
  }
}

// Sync on reconnect, when the app comes back to the foreground, at start, and every minute while open.
export function startOutboxSync() {
  window.addEventListener('online', () => void syncOutbox())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncOutbox())
  setInterval(() => void syncOutbox(), 60_000)
  void syncOutbox()
}

export async function retryItem(item: OutboxItem, { overwrite = false } = {}) {
  const payload = { ...item.payload }
  if (overwrite) delete payload.client_updated_at // resend without the timestamp = overwrite the server's version
  await db.outbox.update(item.id!, { status: 'pending', error: undefined, conflict: false, payload })
  await syncOutbox()
}

export async function discardItem(item: OutboxItem) {
  await db.outbox.delete(item.id!)
  // Optimistic edits in the cache were never saved: reload the server's version.
  await queryClient.invalidateQueries({ queryKey: [item.entity === 'task' ? 'tasks' : 'transactions'] })
}

export function useOutbox() {
  return useLiveQuery(() => db.outbox.orderBy('id').toArray(), [], [] as OutboxItem[])
}

import Dexie, { type EntityTable } from 'dexie'

// Offline level 3 (spec §6.3): writes made without a connection wait here and are replayed in order.
export type OutboxItem = {
  id?: number // auto-increment = replay order
  entity: 'task' | 'transaction' | 'note'
  entityId: string // the record's client-made UUID
  created: boolean // true = the server has never seen this record (shown in "Chưa đồng bộ" lists)
  endpoint: string // PUT target, e.g. /tasks/<uuid> (idempotent upsert)
  payload: Record<string, unknown>
  label: string // human text for the sync sheet
  attempts: number
  status: 'pending' | 'failed'
  error?: string
  conflict?: boolean // 409 from last-write-wins: the user may overwrite
}

class OfflineDb extends Dexie {
  outbox!: EntityTable<OutboxItem, 'id'>

  constructor() {
    super('lifehub-offline')
    this.version(1).stores({ outbox: '++id, entityId, status' })
  }
}

export const db = new OfflineDb()

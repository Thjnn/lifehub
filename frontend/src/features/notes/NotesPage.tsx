import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, NotebookPen, Pin, Plus, RotateCw, Search, WifiOff } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { matchesSearch, notesQuery, useSaveNote, type Note, type NoteInput } from '@/features/notes/api'
import { NoteFormSheet } from '@/features/notes/NoteFormSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useOutbox } from '@/offline/outbox'
import { cn } from '@/lib/utils'

// /app/notes (spec §15.3): search, pin, write offline.
export function NotesPage() {
  const online = useOnlineStatus()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const query = useQuery(notesQuery)

  // Created offline and not on the server yet (same idea as the task list).
  const outbox = useOutbox().filter((item) => item.entity === 'note')
  const syncState = new Map(outbox.map((item) => [item.entityId, item.status]))
  const unsynced = outbox
    .filter((item) => item.created && !query.data?.some((n) => n.id === item.entityId))
    .map((item) => ({ ...(item.payload as NoteInput), id: item.entityId, created_at: '', updated_at: '' }) as Note)
  const notes = [...unsynced, ...(query.data ?? [])].filter((note) => matchesSearch(note, search))

  const [editing, setEditing] = useState<Note>()
  const creating = params.get('new') === '1'
  const closeSheet = () => {
    setEditing(undefined)
    if (creating)
      setParams((prev) => {
        prev.delete('new')
        return prev
      })
  }
  const openNew = () =>
    setParams((prev) => {
      prev.set('new', '1')
      return prev
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong ghi chú (gõ có dấu hay không đều được)"
            aria-label="Tìm ghi chú"
            className="h-9 pl-9"
          />
        </div>
        <Button onClick={openNew}>
          <Plus />
          Thêm
        </Button>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : query.isError && !query.data && unsynced.length === 0 ? (
        <Empty
          icon={online ? RotateCw : WifiOff}
          message={online ? query.error.message : 'Bạn đang offline và chưa có ghi chú lưu sẵn trên máy.'}
          action={online ? <Button variant="outline" onClick={() => query.refetch()}>Thử lại</Button> : undefined}
        />
      ) : notes.length === 0 ? (
        search ? (
          <Empty icon={Search} message={`Không có ghi chú nào chứa "${search}".`} />
        ) : (
          <Empty
            icon={NotebookPen}
            message="Chưa có ghi chú nào. Ghi nhanh ý tưởng, việc cần nhớ, hay ghi chú cho một buổi học."
            action={
              <Button variant="outline" onClick={openNew}>
                <Plus />
                Viết ghi chú
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} sync={syncState.get(note.id)} onOpen={() => setEditing(note)} />
            </li>
          ))}
        </ul>
      )}

      <NoteFormSheet open={creating || editing !== undefined} onOpenChange={(open) => !open && closeSheet()} note={editing} />
    </div>
  )
}

function NoteCard({ note, sync, onOpen }: { note: Note; sync?: 'pending' | 'failed'; onOpen: () => void }) {
  const save = useSaveNote()
  const togglePin = () =>
    save.mutate({
      id: note.id,
      created: false,
      input: { title: note.title, body: note.body, pinned: !note.pinned, task_id: note.task_id, event_id: note.event_id },
    })

  return (
    <article className={cn('relative flex h-full flex-col gap-1 rounded-xl border bg-card p-4', note.pinned && 'border-primary/40')}>
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 pr-8 text-left after:absolute after:inset-0">
        {note.title && <h3 className="line-clamp-1 text-sm font-semibold">{note.title}</h3>}
        <p className="line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{note.body}</p>
      </button>
      <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        {(note.task_id || note.event_id) && (
          <span className="flex items-center gap-1">
            <Link2 className="size-3" aria-hidden />
            {note.task_id ? 'Công việc' : 'Sự kiện'}
          </span>
        )}
        {sync && <span className={sync === 'failed' ? 'text-destructive' : 'text-warning'}>{sync === 'failed' ? 'Lỗi đồng bộ' : 'Chưa đồng bộ'}</span>}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={note.pinned ? 'Bỏ ghim' : 'Ghim'}
        aria-pressed={note.pinned}
        // Above the card-wide button (after:inset-0) so it stays clickable.
        className="absolute top-2 right-2 z-10"
        disabled={save.isPending}
        onClick={togglePin}
      >
        <Pin className={cn(note.pinned && 'fill-current text-primary')} />
      </Button>
    </article>
  )
}

function Empty({ icon: Icon, message, action }: { icon: typeof Search; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}

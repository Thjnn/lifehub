import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { notesQuery, type Note } from '@/features/notes/api'
import { NoteFormSheet, type NoteLink } from '@/features/notes/NoteFormSheet'

// Notes attached to a task or event, shown under its edit form (spec §15.3 "mở từ task/sự kiện được gắn").
export function LinkedNotes({ link }: { link: NoteLink }) {
  const { data = [] } = useQuery(notesQuery)
  const notes = data.filter((n) => (link.task_id ? n.task_id === link.task_id : n.event_id === link.event_id))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Note>()

  return (
    <section className="flex flex-col gap-2 border-t px-4 pt-4 pb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ghi chú ({notes.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(undefined)
            setOpen(true)
          }}
        >
          <Plus />
          Thêm ghi chú
        </Button>
      </div>
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => {
            setEditing(note)
            setOpen(true)
          }}
          className="rounded-lg border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-accent/40"
        >
          {note.title && <span className="block font-medium">{note.title}</span>}
          <span className="line-clamp-2 whitespace-pre-line text-muted-foreground">{note.body}</span>
        </button>
      ))}
      <NoteFormSheet open={open} onOpenChange={setOpen} note={editing} link={link} />
    </section>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { eventsQuery } from '@/features/calendar/api'
import {
  exercisesQuery,
  groupSets,
  kindLabels,
  lastSetsFor,
  summarizeSets,
  useCreateExercise,
  useDeleteWorkout,
  useSaveWorkout,
  workoutsQuery,
  type Exercise,
  type ExerciseKind,
  type Workout,
} from '@/features/fitness/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { searchMatch } from '@/lib/search'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout?: Workout // edit
  template?: Workout // "Lặp lại buổi trước": same exercises and sets, now
}

export function WorkoutSheet({ open, onOpenChange, workout, template }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{workout ? 'Sửa buổi tập' : 'Ghi buổi tập'}</SheetTitle>
        </SheetHeader>
        {open && <WorkoutForm key={workout?.id ?? template?.id ?? 'new'} workout={workout} template={template} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

// Inputs stay strings while typing; converted on save.
type Row = { reps: string; weight_kg: string; duration_min: string; distance_km: string }
type Block = { key: number; exercise: Pick<Exercise, 'id' | 'name' | 'kind'>; rows: Row[] }

const text = (v: number | null) => (v === null ? '' : String(v))
const number = (v: string) => (v.trim() === '' ? null : Number(v))
const emptyRow: Row = { reps: '', weight_kg: '', duration_min: '', distance_km: '' }
const rowDone = (kind: ExerciseKind, r: Row) => (kind === 'cardio' ? Number(r.duration_min) > 0 : Number(r.reps) > 0)

let nextKey = 0

function WorkoutForm({ workout, template, onDone }: { workout?: Workout; template?: Workout; onDone: () => void }) {
  const workouts = useQuery(workoutsQuery)
  const save = useSaveWorkout()
  const remove = useDeleteWorkout()
  const source = workout ?? template
  const [performedAt, setPerformedAt] = useState(() => toDateTimeLocal(workout?.performed_at ?? new Date().toISOString()))
  const [duration, setDuration] = useState(text(source?.duration_min ?? null))
  const [note, setNote] = useState(workout?.note ?? '')
  const [eventId, setEventId] = useState(workout?.event_id ?? null)
  const [blocks, setBlocks] = useState<Block[]>(() =>
    groupSets(source?.sets ?? []).map((g) => ({
      key: nextKey++,
      exercise: { id: g.exercise_id, name: g.sets[0].exercise_name, kind: g.sets[0].kind },
      rows: g.sets.map((s) => ({ reps: text(s.reps), weight_kg: text(s.weight_kg), duration_min: text(s.duration_min), distance_km: text(s.distance_km) })),
    })),
  )
  const [picking, setPicking] = useState(!source)
  const [error, setError] = useState<string>()

  // "Tập luyện" events on the same day, to link this workout to the calendar.
  const day = performedAt.slice(0, 10)
  const events = useQuery({
    ...eventsQuery(day ? new Date(`${day}T00:00`).toISOString() : '', day ? new Date(`${day}T23:59:59`).toISOString() : ''),
    enabled: day.length === 10,
  })
  const workoutEvents = events.data?.filter((e) => e.event_type === 'workout') ?? []

  const updateRow = (key: number, index: number, patch: Partial<Row>) =>
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, rows: b.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : b)))

  async function submit() {
    setError(undefined)
    const sets = blocks.flatMap((b) =>
      b.rows.map((r) => ({ exercise_id: b.exercise.id, reps: number(r.reps), weight_kg: number(r.weight_kg), duration_min: number(r.duration_min), distance_km: number(r.distance_km) })),
    )
    try {
      await save.mutateAsync({ id: workout?.id, input: { performed_at: fromDateTimeLocal(performedAt)!, duration_min: number(duration), note: note.trim() || null, event_id: eventId, sets } })
      toast.success(workout ? 'Đã lưu buổi tập' : 'Đã ghi buổi tập')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(workout!.id)
      toast.success('Đã xoá buổi tập')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xoá được')
    }
  }

  const ready = performedAt !== '' && blocks.length > 0 && blocks.every((b) => b.rows.length > 0 && b.rows.every((r) => rowDone(b.exercise.kind, r)))

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Thời gian" type="datetime-local" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
        <TextField label="Thời lượng (phút)" type="number" inputMode="numeric" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>
      {workoutEvents.length > 0 && (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Gắn với lịch
          <select
            value={eventId ?? ''}
            onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm font-normal"
          >
            <option value="">Không gắn</option>
            {workoutEvents.map((e) => (
              <option key={e.key} value={e.id}>
                {new Date(e.start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {e.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {blocks.map((block) => {
        const last = lastSetsFor(workouts.data ?? [], block.exercise.id, workout?.id)
        const cardio = block.exercise.kind === 'cardio'
        return (
          <section key={block.key} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{block.exercise.name}</p>
                <p className="text-xs text-muted-foreground">{last ? `Lần trước: ${summarizeSets(last)}` : 'Lần đầu tập bài này'}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Bỏ ${block.exercise.name}`} onClick={() => setBlocks((bs) => bs.filter((b) => b.key !== block.key))}>
                <Trash2 />
              </Button>
            </div>
            {block.rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-10 shrink-0 text-xs text-muted-foreground">Set {i + 1}</span>
                {cardio ? (
                  <>
                    <Input aria-label={`Set ${i + 1}: phút`} type="number" inputMode="decimal" placeholder="phút" value={row.duration_min} onChange={(e) => updateRow(block.key, i, { duration_min: e.target.value })} className="h-8" />
                    <Input aria-label={`Set ${i + 1}: km`} type="number" inputMode="decimal" placeholder="km" value={row.distance_km} onChange={(e) => updateRow(block.key, i, { distance_km: e.target.value })} className="h-8" />
                  </>
                ) : (
                  <>
                    <Input aria-label={`Set ${i + 1}: số lần`} type="number" inputMode="numeric" placeholder="số lần" value={row.reps} onChange={(e) => updateRow(block.key, i, { reps: e.target.value })} className="h-8" />
                    <Input
                      aria-label={`Set ${i + 1}: kg`}
                      type="number"
                      inputMode="decimal"
                      placeholder={block.exercise.kind === 'bodyweight' ? 'kg thêm' : 'kg'}
                      value={row.weight_kg}
                      onChange={(e) => updateRow(block.key, i, { weight_kg: e.target.value })}
                      className="h-8"
                    />
                  </>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Xoá set ${i + 1}`}
                  onClick={() => setBlocks((bs) => bs.map((b) => (b.key === block.key ? { ...b, rows: b.rows.filter((_, j) => j !== i) } : b)))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              // A new set starts as a copy of the previous one: usually only one number changes.
              onClick={() => setBlocks((bs) => bs.map((b) => (b.key === block.key ? { ...b, rows: [...b.rows, { ...(b.rows.at(-1) ?? emptyRow) }] } : b)))}
            >
              <Plus />
              Thêm set
            </Button>
          </section>
        )
      })}

      {picking ? (
        <ExercisePicker
          onPick={(exercise) => {
            setBlocks((bs) => [...bs, { key: nextKey++, exercise, rows: [{ ...emptyRow }] }])
            setPicking(false)
          }}
          onCancel={blocks.length > 0 ? () => setPicking(false) : undefined}
        />
      ) : (
        <Button variant="outline" onClick={() => setPicking(true)}>
          <Plus />
          Thêm bài tập
        </Button>
      )}

      <Textarea aria-label="Ghi chú" placeholder="Ghi chú (không bắt buộc)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormError message={error} />
      <Button size="lg" disabled={!ready || save.isPending} onClick={submit}>
        {save.isPending ? 'Đang lưu…' : workout ? 'Lưu buổi tập' : 'Ghi buổi tập'}
      </Button>
      {workout && (
        <Button variant="destructive" size="lg" disabled={remove.isPending} onClick={handleDelete}>
          <Trash2 />
          Xoá buổi tập
        </Button>
      )}
    </div>
  )
}

// Search the exercise list; an exercise that isn't there can be created on the spot.
function ExercisePicker({ onPick, onCancel }: { onPick: (exercise: Exercise) => void; onCancel?: () => void }) {
  const exercises = useQuery(exercisesQuery)
  const create = useCreateExercise()
  const [search, setSearch] = useState('')
  const matches = exercises.data?.filter((e) => searchMatch(`${e.name} ${e.muscle_group ?? ''}`, search)) ?? []
  const exact = exercises.data?.some((e) => e.name.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bài: squat, hit dat, chay…" aria-label="Tìm bài tập" autoFocus />
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Đóng
          </Button>
        )}
      </div>
      {exercises.isError && <FormError message={exercises.error.message} />}
      <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-lg border">
        {matches.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40">
              <span>{e.name}</span>
              <span className="text-xs whitespace-nowrap text-muted-foreground">{e.muscle_group ?? kindLabels[e.kind]}</span>
            </button>
          </li>
        ))}
      </ul>
      {search.trim() !== '' && !exact && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tạo bài "{search.trim()}" loại:</span>
          {(Object.keys(kindLabels) as ExerciseKind[]).map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              disabled={create.isPending}
              onClick={() => create.mutate({ name: search.trim(), kind }, { onSuccess: onPick, onError: (err) => toast.error(err.message) })}
            >
              {kindLabels[kind]}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

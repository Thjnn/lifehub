import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Dumbbell, Plus, Repeat } from 'lucide-react'
import { FormError } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { groupSets, summarizeSets, workoutsQuery, type Workout } from '@/features/fitness/api'
import { WorkoutSheet } from '@/features/fitness/WorkoutSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDayHeader } from '@/lib/format'

// /app/nutrition/workouts (spec §15.4): log workouts set by set; "last time" hints come from this history.
export function WorkoutsPage() {
  const online = useOnlineStatus()
  const workouts = useQuery(workoutsQuery)
  const [sheet, setSheet] = useState<{ workout?: Workout; template?: Workout }>()
  const latest = workouts.data?.[0]

  // Workouts in the last 7 days, the number the nutrition profile's activity level is about.
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000)
  const thisWeek = workouts.data?.filter((w) => new Date(w.performed_at).getTime() >= weekAgo).length ?? 0

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button disabled={!online} onClick={() => setSheet({})}>
          <Plus />
          Ghi buổi tập
        </Button>
        {latest && (
          <Button variant="outline" disabled={!online} onClick={() => setSheet({ template: latest })}>
            <Repeat />
            Lặp lại buổi trước
          </Button>
        )}
      </div>

      {workouts.data && workouts.data.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarCheck className="size-4" aria-hidden />
          7 ngày qua: <span className="font-semibold text-foreground tabular-nums">{thisWeek}</span> buổi tập
        </p>
      )}

      {workouts.isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : workouts.isError && !workouts.data ? (
        <FormError message={online ? workouts.error.message : 'Bạn đang offline và chưa có lịch sử tập trên máy.'} />
      ) : workouts.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <Dumbbell className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">Chưa có buổi tập nào. Ghi lại từng set (số lần × kg, hoặc phút/km) để lần sau biết nên tăng tạ hay tăng số lần.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts.data.map((w) => (
            <li key={w.id}>
              <button type="button" disabled={!online} onClick={() => setSheet({ workout: w })} className="flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left hover:bg-accent/30">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{formatDayHeader(new Date(w.performed_at))}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(w.performed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    {w.duration_min && ` · ${w.duration_min} phút`}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {groupSets(w.sets).map((g, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{g.sets[0].exercise_name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{summarizeSets(g.sets)}</span>
                    </li>
                  ))}
                </ul>
                {w.note && <p className="line-clamp-2 text-xs text-muted-foreground">{w.note}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <WorkoutSheet open={sheet !== undefined} onOpenChange={(open) => !open && setSheet(undefined)} workout={sheet?.workout} template={sheet?.template} />
    </div>
  )
}

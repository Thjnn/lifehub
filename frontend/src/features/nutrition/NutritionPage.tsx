import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Info, Plus, Salad, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormError } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { dayQuery, goalLabels, mealLabels, profileQuery, useDeleteEntry, type Meal } from '@/features/nutrition/api'
import { EntrySheet } from '@/features/nutrition/EntrySheet'
import { ProfileSheet } from '@/features/nutrition/ProfileSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { dateKey, formatDayHeader, fromDateKey } from '@/lib/format'
import { cn } from '@/lib/utils'

const meals = Object.keys(mealLabels) as Meal[]

// /app/nutrition (spec §15.4): targets by formula, food log per day.
export function NutritionPage() {
  const online = useOnlineStatus()
  const [today] = useState(() => dateKey(new Date()))
  const [date, setDate] = useState(today)
  const shift = (days: number) => {
    const d = fromDateKey(date)
    d.setDate(d.getDate() + days)
    setDate(dateKey(d))
  }

  const profile = useQuery(profileQuery)
  const day = useQuery(dayQuery(date))
  const remove = useDeleteEntry()
  const [profileOpen, setProfileOpen] = useState(false)
  const [addingTo, setAddingTo] = useState<Meal>()

  // Logged for today → now; for another day → midday of that day.
  const eatenAt = () => (date === today ? new Date() : new Date(fromDateKey(date).setHours(12))).toISOString()

  const totals = day.data?.meta.totals
  const targets = profile.data?.targets

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Ngày trước" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <span className="font-semibold">{formatDayHeader(fromDateKey(date))}</span>
        <Button variant="ghost" size="icon" aria-label="Ngày sau" disabled={date >= today} onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
      </div>

      {profile.isPending ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : !profile.data ? (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card/50 p-4">
          <Salad className="size-7 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Nhập cân nặng, chiều cao và mục tiêu để LIFEHUB tính lượng calo và protein bạn cần mỗi ngày.</p>
          <Button disabled={!online} onClick={() => setProfileOpen(true)}>
            Thiết lập hồ sơ
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Mục tiêu: {goalLabels[profile.data.goal]} · {profile.data.weight_kg} kg
            </h2>
            <Button size="sm" variant="ghost" disabled={!online} onClick={() => setProfileOpen(true)}>
              Sửa hồ sơ
            </Button>
          </div>
          <Meter label="Calo" unit="kcal" value={totals?.kcal ?? 0} target={targets!.kcal} />
          <Meter label="Đạm (protein)" unit="g" value={totals?.protein_g ?? 0} target={targets!.protein_g} />
          <p className="text-xs text-muted-foreground tabular-nums">
            Tinh bột {totals?.carbs_g ?? 0} g · Chất béo {totals?.fat_g ?? 0} g · Tiêu hao ước tính {targets!.tdee} kcal/ngày
          </p>
        </section>
      )}

      {day.isError && !day.data && <FormError message={online ? day.error.message : 'Bạn đang offline và chưa có dữ liệu ngày này trên máy.'} />}

      {meals.map((meal) => {
        const entries = day.data?.data.filter((e) => e.meal === meal) ?? []
        const kcal = Math.round(entries.reduce((sum, e) => sum + e.kcal, 0))
        return (
          <section key={meal} className="rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
              <h3 className="text-sm font-semibold">
                {mealLabels[meal]} {kcal > 0 && <span className="font-normal text-muted-foreground tabular-nums">· {kcal} kcal</span>}
              </h3>
              <Button size="sm" variant="ghost" disabled={!online} onClick={() => setAddingTo(meal)}>
                <Plus />
                Thêm
              </Button>
            </div>
            {day.isPending ? (
              <Skeleton className="m-4 h-6" />
            ) : entries.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Chưa ghi món nào.</p>
            ) : (
              <ul className="divide-y">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        {e.name}
                        {e.source === 'manual' && <span className="ml-2 text-xs text-muted-foreground">(tự nhập)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {e.grams ? `${e.grams} g · ` : ''}đạm {e.protein_g} g
                      </p>
                    </div>
                    <span className="tabular-nums">{Math.round(e.kcal)} kcal</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Xoá ${e.name}`}
                      disabled={!online || remove.isPending}
                      onClick={() => remove.mutate(e.id, { onError: (err) => toast.error(err.message) })}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Số liệu là ước tính tham khảo (món ăn khác nhau theo cách nấu và khẩu phần), không thay cho tư vấn dinh dưỡng hay y tế.
      </p>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} profile={profile.data ?? null} />
      <EntrySheet open={addingTo !== undefined} onOpenChange={(open) => !open && setAddingTo(undefined)} meal={addingTo ?? 'snack'} eatenAt={eatenAt} />
    </div>
  )
}

// Eaten vs target; over the target is shown in words too, never by colour alone.
function Meter({ label, unit, value, target }: { label: string; unit: string; value: number; target: number }) {
  const percent = target > 0 ? Math.round((value / target) * 100) : 0
  const left = Math.round(target - value)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {Math.round(value)} / {target} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}>
        <div className={cn('h-full rounded-full', percent > 110 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className={cn('text-xs', percent > 110 ? 'text-warning' : 'text-muted-foreground')}>
        {left >= 0 ? `Còn ${left} ${unit}` : `Vượt ${-left} ${unit}`}
      </p>
    </div>
  )
}

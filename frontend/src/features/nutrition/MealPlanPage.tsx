import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Info, Plus, RotateCw, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  mealLabels,
  mealPlanQuery,
  mondayOf,
  profileQuery,
  useConfirmMealPlan,
  useDeletePlanItem,
  useGenerateMealPlan,
  type MealPlanProposal,
  type PlanItem,
  type ProposedItem,
  type Targets,
} from '@/features/nutrition/api'
import { PlanItemSheet } from '@/features/nutrition/PlanItemSheet'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { dateKey, formatDayHeader, fromDateKey } from '@/lib/format'
import { formatVnd, sumMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const mealOrder = Object.keys(mealLabels)

// /app/nutrition/plan (spec §15.4): AI proposes a week from the dish table → user confirms → "Đã ăn" in the log.
export function MealPlanPage() {
  const online = useOnlineStatus()
  const [week, setWeek] = useState(() => mondayOf(dateKey(new Date())))
  const shiftWeek = (weeks: number) => {
    const d = fromDateKey(week)
    d.setDate(d.getDate() + weeks * 7)
    setWeek(dateKey(d))
    setProposal(undefined)
  }

  const profile = useQuery(profileQuery)
  const plan = useQuery(mealPlanQuery(week))
  const generate = useGenerateMealPlan()
  const confirm = useConfirmMealPlan()
  const [proposal, setProposal] = useState<MealPlanProposal>()
  const [editing, setEditing] = useState<{ item?: PlanItem; date: string }>()
  // A new dish goes on today when today is in this week, else on Monday.
  const [today] = useState(() => dateKey(new Date()))
  const defaultDay = mondayOf(today) === week ? today : week

  const askAi = () => generate.mutate(week, { onSuccess: setProposal, onError: (err) => toast.error(err.message) })
  const accept = () =>
    confirm.mutate(proposal!.id, {
      onSuccess: () => {
        setProposal(undefined)
        toast.success('Đã lưu thực đơn tuần')
      },
      onError: (err) => toast.error(err.message),
    })

  const sunday = fromDateKey(week)
  sunday.setDate(sunday.getDate() + 6)
  const targets = profile.data?.targets
  const items = plan.data?.data ?? []

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Tuần trước" onClick={() => shiftWeek(-1)}>
          <ChevronLeft />
        </Button>
        <span className="font-semibold tabular-nums">
          Tuần {fromDateKey(week).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – {sunday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
        </span>
        <Button variant="ghost" size="icon" aria-label="Tuần sau" onClick={() => shiftWeek(1)}>
          <ChevronRight />
        </Button>
      </div>

      {profile.data === null ? (
        <p className="rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
          Cần có mục tiêu calo trước khi lên thực đơn.{' '}
          <Link to="/app/nutrition" className="font-medium text-primary underline-offset-4 hover:underline">
            Thiết lập hồ sơ dinh dưỡng
          </Link>
        </p>
      ) : proposal ? (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Thực đơn AI đề xuất — chưa lưu
          </h2>
          <CostLine total={proposal.payload.total_cost_vnd} budget={proposal.payload.budget_vnd} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!online || confirm.isPending} onClick={accept}>
              <Check />
              Xác nhận
            </Button>
            <Button variant="outline" disabled={!online || generate.isPending} onClick={askAi}>
              <RotateCw className={cn(generate.isPending && 'animate-spin')} />
              Tạo lại
            </Button>
            <Button variant="ghost" onClick={() => setProposal(undefined)}>
              Bỏ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Đây chỉ là gợi ý. Xác nhận xong bạn vẫn đổi món, sửa gram, thêm hay bỏ món tuỳ ý.
            {items.some((i) => !i.food_entry_id) && ' Xác nhận sẽ thay các món chưa ăn của tuần này; món đã ăn được giữ nguyên.'}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button disabled={!online || generate.isPending || profile.isPending} onClick={askAi}>
              <Sparkles className={cn(generate.isPending && 'animate-pulse')} />
              {generate.isPending ? 'AI đang lên thực đơn…' : items.length ? 'Lên lại thực đơn bằng AI' : 'Lên thực đơn tuần bằng AI'}
            </Button>
            <Button variant="outline" disabled={!online} onClick={() => setEditing({ date: defaultDay })}>
              <Plus />
              Tự thêm món
            </Button>
          </div>
          {plan.data && items.length > 0 && <CostLine total={sumMoney(items.map((i) => i.est_cost ?? '0'))} budget={plan.data.meta.budget_vnd} />}
        </div>
      )}

      {plan.isError && !plan.data && <FormError message={online ? plan.error.message : 'Bạn đang offline và chưa có thực đơn tuần này trên máy.'} />}

      {proposal ? (
        <Week items={proposal.payload.items} targets={targets} />
      ) : plan.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : items.length === 0 && plan.data ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Chưa có thực đơn cho tuần này. AI sẽ chọn món Việt trong bảng món ăn, khớp calo/protein mục tiêu và ngân sách "Ăn uống" của bạn.
        </p>
      ) : (
        <Week items={items} targets={targets} onEdit={(item) => setEditing({ item, date: item.date })} onAdd={(date) => setEditing({ date })} />
      )}

      <PlanItemSheet open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)} item={editing?.item} date={editing?.date ?? defaultDay} />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Calo lấy từ bảng món ăn; giá là AI ước tính. Thông tin mục tiêu và danh sách món được gửi tới Google Gemini. Gợi ý chỉ để tham khảo, không thay tư vấn dinh dưỡng/y tế.
      </p>
    </div>
  )
}

function CostLine({ total, budget }: { total: string; budget: string | null }) {
  const over = budget !== null && Number(total) > Number(budget)
  return (
    <p className={cn('text-sm tabular-nums', over ? 'text-warning' : 'text-muted-foreground')}>
      Chi phí ước tính {formatVnd(total)}
      {budget === null ? ' · chưa đặt ngân sách "Ăn uống" tháng này' : ` / ngân sách tuần ${formatVnd(budget)}${over ? ' (vượt)' : ''}`}
    </p>
  )
}

// Days of the week, each with its meals. With onEdit/onAdd (the saved plan, not a proposal) dishes can be changed,
// added and removed.
function Week({
  items,
  targets,
  onEdit,
  onAdd,
}: {
  items: (ProposedItem | PlanItem)[]
  targets?: Targets
  onEdit?: (item: PlanItem) => void
  onAdd?: (date: string) => void
}) {
  const remove = useDeletePlanItem()
  const online = useOnlineStatus()
  const days = [...new Set(items.map((i) => i.date))].sort()

  return days.map((date) => {
    const dayItems = items.filter((i) => i.date === date).sort((a, b) => mealOrder.indexOf(a.meal) - mealOrder.indexOf(b.meal))
    const kcal = Math.round(dayItems.reduce((sum, i) => sum + i.kcal, 0))
    const protein = Math.round(dayItems.reduce((sum, i) => sum + i.protein_g, 0))
    return (
      <section key={date} className="rounded-xl border bg-card">
        <div className="flex items-baseline justify-between gap-2 border-b px-4 py-2">
          <h3 className="text-sm font-semibold">{formatDayHeader(fromDateKey(date))}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {kcal}
            {targets && `/${targets.kcal}`} kcal · đạm {protein}
            {targets && `/${targets.protein_g}`} g
          </span>
        </div>
        <ul className="divide-y">
          {dayItems.map((item, index) => {
            const saved = 'id' in item ? item : undefined
            return (
              <li key={saved?.id ?? index} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{mealLabels[item.meal]}</span>
                {saved && !saved.food_entry_id && onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(saved)}
                    disabled={!online}
                    aria-label={`Sửa ${item.name}`}
                    className="min-w-0 flex-1 rounded-md text-left hover:text-primary disabled:hover:text-inherit"
                  >
                    <DishText item={item} />
                  </button>
                ) : (
                  <div className={cn('min-w-0 flex-1', saved?.food_entry_id && 'text-muted-foreground line-through')}>
                    <DishText item={item} />
                  </div>
                )}
                {saved?.food_entry_id ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" aria-hidden />
                    Đã ăn
                  </span>
                ) : (
                  saved && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Bỏ ${item.name} khỏi thực đơn`}
                      disabled={!online || remove.isPending}
                      onClick={() => remove.mutate(saved.id, { onError: (err) => toast.error(err.message) })}
                    >
                      <X />
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
        {onAdd && (
          <Button size="sm" variant="ghost" className="m-2" disabled={!online} onClick={() => onAdd(date)}>
            <Plus />
            Thêm món
          </Button>
        )}
      </section>
    )
  })
}

function DishText({ item }: { item: ProposedItem }) {
  return (
    <>
      <p className="truncate">{item.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {item.grams} g · {Math.round(item.kcal)} kcal{item.est_cost && ` · ~${formatVnd(item.est_cost)}`}
      </p>
    </>
  )
}

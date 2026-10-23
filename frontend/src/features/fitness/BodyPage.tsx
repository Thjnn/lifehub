import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Scale, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { measurementsQuery, useDeleteMeasurement, useSaveMeasurement, type Measurement } from '@/features/fitness/api'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { dateKey, fromDateKey } from '@/lib/format'

const shortDate = (key: string) => fromDateKey(key).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

// /app/nutrition/body (spec §15.4): weigh-ins (one per day). The newest weight updates the nutrition targets.
export function BodyPage() {
  const online = useOnlineStatus()
  const measurements = useQuery(measurementsQuery)
  const save = useSaveMeasurement()
  const remove = useDeleteMeasurement()
  const [today] = useState(() => dateKey(new Date()))
  const [form, setForm] = useState({ date: today, weight: '', waist: '', fat: '' })
  const [error, setError] = useState<string>()

  async function submit() {
    setError(undefined)
    const optional = (v: string) => (v.trim() === '' ? null : Number(v))
    try {
      await save.mutateAsync({ date: form.date, input: { weight_kg: Number(form.weight), waist_cm: optional(form.waist), body_fat_pct: optional(form.fat) } })
      toast.success('Đã lưu cân nặng — mục tiêu dinh dưỡng đã cập nhật')
      setForm({ ...form, weight: '', waist: '', fat: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  const rows = measurements.data ?? [] // newest first
  const latest = rows[0]
  // Change over ~30 days: against the newest weigh-in at least 30 days older, else the oldest one.
  const monthAgo = latest && (rows.find((m) => fromDateKey(latest.measured_on).getTime() - fromDateKey(m.measured_on).getTime() >= 30 * 86_400_000) ?? rows.at(-1))
  const change = latest && monthAgo && monthAgo !== latest ? Math.round((latest.weight_kg - monthAgo.weight_kg) * 10) / 10 : null

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Ghi cân nặng</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField label="Ngày" type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextField label="Cân nặng (kg)" type="number" inputMode="decimal" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          <TextField label="Vòng eo (cm)" type="number" inputMode="decimal" placeholder="Tuỳ chọn" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
          <TextField label="% mỡ" type="number" inputMode="decimal" placeholder="Tuỳ chọn" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
        </div>
        <FormError message={error} />
        <Button className="self-start" disabled={!online || save.isPending || !form.date || !(Number(form.weight) > 0)} onClick={submit}>
          {save.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <p className="text-xs text-muted-foreground">Mỗi ngày một lần đo (ghi lại sẽ thay số cũ). Cân nặng mới nhất được dùng để tính calo/protein mục tiêu.</p>
      </section>

      {measurements.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : measurements.isError && !measurements.data ? (
        <FormError message={online ? measurements.error.message : 'Bạn đang offline và chưa có dữ liệu cân nặng trên máy.'} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
          <Scale className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">Chưa có lần đo nào. Cân vào cùng một thời điểm mỗi ngày (ví dụ buổi sáng sau khi thức dậy) để xu hướng chính xác hơn.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Hiện tại" value={`${latest.weight_kg} kg`} note={shortDate(latest.measured_on)} />
            <StatTile
              label="Thay đổi"
              value={change === null ? '—' : `${change > 0 ? '+' : ''}${change} kg`}
              note={change === null ? 'cần ít nhất 2 lần đo' : `so với ${shortDate(monthAgo!.measured_on)}`}
            />
          </div>
          {rows.length >= 2 && <WeightTrend points={rows.slice(0, 60).reverse()} />}
          <section className="rounded-xl border bg-card">
            <h3 className="border-b px-4 py-2 text-sm font-semibold">Các lần đo</h3>
            <ul className="divide-y">
              {rows.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm tabular-nums">
                  <span className="w-14 shrink-0 text-muted-foreground">{shortDate(m.measured_on)}</span>
                  <span className="flex-1">
                    {m.weight_kg} kg
                    {m.waist_cm !== null && <span className="text-muted-foreground"> · eo {m.waist_cm} cm</span>}
                    {m.body_fat_pct !== null && <span className="text-muted-foreground"> · mỡ {m.body_fat_pct}%</span>}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Xoá lần đo ngày ${shortDate(m.measured_on)}`}
                    disabled={!online || remove.isPending}
                    onClick={() => remove.mutate(m.id, { onError: (err) => toast.error(err.message) })}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  )
}

// One series → no legend (the title names it). A line, not bars: bars must start at 0, which flattens a weight trend.
// Thin 2px line, ≥8px dots with a hover tooltip; the list below is the table view.
// The line is an SVG stretched to the box (non-scaling 2px stroke); dots are HTML placed in %, so they stay round at any width.
function WeightTrend({ points }: { points: Measurement[] }) {
  const weights = points.map((p) => p.weight_kg)
  const [lo, hi] = [Math.min(...weights), Math.max(...weights)]
  const span = Math.max(hi - lo, 1) // flat weight still gets a readable scale
  // Positions in % of the plot box, with a little inset so edge dots aren't clipped.
  const x = (i: number) => 2 + (i * 96) / (points.length - 1)
  const y = (kg: number) => 8 + ((hi - kg) * 84) / span

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <h3 className="font-semibold">Xu hướng cân nặng</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {lo}–{hi} kg
        </span>
      </div>
      <div className="relative h-40" role="img" aria-label={`Cân nặng từ ${points[0].weight_kg} kg đến ${points.at(-1)!.weight_kg} kg`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {[lo, hi].map((kg) => (
            <line key={kg} x1={0} x2={100} y1={y(kg)} y2={y(kg)} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline
            points={points.map((p, i) => `${x(i)},${y(p.weight_kg)}`).join(' ')}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => (
          // Hit target (24px) larger than the 8px dot; native tooltip on hover/long-press.
          <span
            key={p.id}
            title={`${shortDate(p.measured_on)}: ${p.weight_kg} kg`}
            className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${x(i)}%`, top: `${y(p.weight_kg)}%` }}
          >
            <span className="size-2.5 rounded-full border-2 border-card bg-primary" />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{shortDate(points[0].measured_on)}</span>
        <span>{shortDate(points.at(-1)!.measured_on)}</span>
      </div>
    </section>
  )
}

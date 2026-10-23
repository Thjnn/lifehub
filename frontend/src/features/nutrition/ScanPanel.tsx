import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Info, RotateCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { foodsQuery, scaleFood, useAddEntry, useFoodScan, type Food, type Meal, type ScanItem } from '@/features/nutrition/api'
import { FoodPicker } from '@/features/nutrition/FoodPicker'
import { toScanDataUrl } from '@/features/nutrition/scan'
import { useOnlineStatus } from '@/hooks/use-online-status'

// One recognised dish under review: a table dish (food) or Gemini's estimate (scaled with the grams).
type Row = { key: number; name: string; grams: number; food?: Food; estimate?: ScanItem; confidence: number; picking: boolean }

const macrosOf = (row: Row) =>
  row.food
    ? scaleFood(row.food, row.grams)
    : (['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).reduce(
        (m, k) => ({ ...m, [k]: Math.round((row.estimate![k] * row.grams * 10) / row.estimate!.grams) / 10 }),
        {} as Record<'kcal' | 'protein_g' | 'carbs_g' | 'fat_g', number>,
      )

// Food scan (spec §15.1): photo → Gemini recognises dishes → the user fixes them → logged as normal entries.
export function ScanPanel({ meal, eatenAt, onDone }: { meal: Meal; eatenAt: () => string; onDone: () => void }) {
  const online = useOnlineStatus()
  const foods = useQuery(foodsQuery)
  const scan = useFoodScan()
  const save = useAddEntry()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<Row[]>()
  const [error, setError] = useState<string>()

  async function onPhoto(file?: File) {
    if (!file) return
    setError(undefined)
    try {
      const { name, items } = await scan.mutateAsync(await toScanDataUrl(file))
      setName(name)
      setRows(
        items.map((item, key) => ({
          key,
          name: item.name,
          grams: item.grams,
          food: foods.data?.find((f) => f.id === item.food_id),
          estimate: item.estimated ? item : undefined,
          confidence: item.confidence,
          picking: false,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không quét được ảnh')
    } finally {
      if (input.current) input.current.value = '' // the same photo can be picked again
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  // The whole plate is one entry (e.g. "Salad ức gà"); its components open from the log.
  async function logPlate() {
    const components = rows!.map((r) => ({ name: r.food?.name ?? r.name, food_id: r.food?.id ?? null, grams: r.grams, ...macrosOf(r) }))
    try {
      await save.mutateAsync({ eaten_at: eatenAt(), meal, name: name.trim(), components })
      toast.success(`Đã ghi "${name.trim()}"`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  const ready = rows !== undefined && rows.length > 0 && name.trim() !== '' && rows.every((r) => r.grams > 0 && !r.picking)
  const total = rows?.reduce((sum, r) => {
    const m = macrosOf(r)
    return { kcal: sum.kcal + m.kcal, protein_g: sum.protein_g + m.protein_g }
  }, { kcal: 0, protein_g: 0 })

  return (
    <div className="flex flex-col gap-3">
      {/* capture: opens the rear camera on phones; a normal file picker on desktop. */}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />

      {rows === undefined ? (
        <Button size="lg" disabled={!online || scan.isPending} onClick={() => input.current?.click()}>
          <Camera className={scan.isPending ? 'animate-pulse' : undefined} />
          {scan.isPending ? 'AI đang nhận diện món…' : 'Chụp hoặc chọn ảnh món ăn'}
        </Button>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">AI không nhận ra món nào trong ảnh. Thử chụp gần hơn, đủ sáng, hoặc chọn món thủ công.</p>
      ) : (
        <>
          <TextField label="Tên món" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          <p className="text-sm tabular-nums">
            Tổng: <span className="font-semibold">{Math.round(total!.kcal)} kcal</span> · đạm {Math.round(total!.protein_g * 10) / 10} g
            <span className="text-muted-foreground"> — gồm {rows.length} thành phần:</span>
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const m = macrosOf(row)
              return (
                <li key={row.key} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{row.food?.name ?? row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.food ? 'Số liệu từ bảng món ăn' : <span className="text-warning">AI ước tính — không có trong bảng</span>}
                        {row.confidence < 0.6 && ' · AI chưa chắc món này'}
                      </p>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Bỏ ${row.name}`} onClick={() => setRows((rs) => rs?.filter((r) => r.key !== row.key))}>
                      <X />
                    </Button>
                  </div>
                  {row.picking ? (
                    <FoodPicker food={undefined} grams={0} onPick={(f) => f && update(row.key, { food: f, grams: f.serving_grams, picking: false })} onGrams={() => {}} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        aria-label={`Khối lượng ${row.name} (g)`}
                        value={row.grams || ''}
                        onChange={(e) => update(row.key, { grams: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                      <span className="text-sm text-muted-foreground">g</span>
                      <span className="flex-1 text-sm tabular-nums">
                        {Math.round(m.kcal)} kcal · đạm {m.protein_g} g
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => update(row.key, { picking: true })}>
                        {row.food ? 'Đổi món' : 'Chọn trong bảng'}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <FormError message={error} />

      {rows !== undefined && (
        <div className="flex flex-wrap gap-2">
          {rows.length > 0 && (
            <Button size="lg" className="flex-1" disabled={!ready || save.isPending} onClick={logPlate}>
              {save.isPending ? 'Đang lưu…' : 'Ghi vào nhật ký'}
            </Button>
          )}
          <Button size="lg" variant="outline" disabled={!online || scan.isPending} onClick={() => input.current?.click()}>
            <RotateCw className={scan.isPending ? 'animate-spin' : undefined} />
            Chụp lại
          </Button>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Ảnh được gửi tới Google Gemini để nhận diện rồi bỏ đi, LIFEHUB không lưu ảnh. Bản miễn phí của Gemini có thể dùng dữ liệu để cải thiện sản phẩm. AI hay đoán sai khẩu phần — hãy kiểm tra số gram trước khi ghi.
      </p>
    </div>
  )
}

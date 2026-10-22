import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { foodsQuery, mealLabels, scaleFood, useAddEntry, type Food, type Meal } from '@/features/nutrition/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { searchMatch } from '@/lib/search'
import { cn } from '@/lib/utils'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; meal: Meal; eatenAt: () => string }

export function EntrySheet({ open, onOpenChange, meal, eatenAt }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Thêm vào {mealLabels[meal].toLowerCase()}</SheetTitle>
        </SheetHeader>
        {open && <EntryForm meal={meal} eatenAt={eatenAt} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const portions = [0.5, 1, 1.5, 2]

function EntryForm({ meal, eatenAt, onDone }: { meal: Meal; eatenAt: () => string; onDone: () => void }) {
  const foods = useQuery(foodsQuery)
  const add = useAddEntry()
  const [mode, setMode] = useState<'table' | 'manual'>('table')
  const [search, setSearch] = useState('')
  const [food, setFood] = useState<Food>()
  const [grams, setGrams] = useState(0)
  const [manual, setManual] = useState({ name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' })
  const [error, setError] = useState<string>()

  async function submit() {
    setError(undefined)
    const base = { eaten_at: eatenAt(), meal }
    const input =
      mode === 'table'
        ? { ...base, food_id: food!.id, grams }
        : { ...base, name: manual.name.trim(), grams: null, kcal: Number(manual.kcal), protein_g: Number(manual.protein_g), carbs_g: Number(manual.carbs_g), fat_g: Number(manual.fat_g) }
    try {
      await add.mutateAsync(input)
      toast.success('Đã ghi món ăn')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  const preview = food && grams > 0 ? scaleFood(food, grams) : undefined
  const manualValid = manual.name.trim() !== '' && ['kcal', 'protein_g', 'carbs_g', 'fat_g'].every((k) => manual[k as keyof typeof manual] !== '' && Number(manual[k as keyof typeof manual]) >= 0)

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div role="tablist" className="flex gap-1 rounded-xl border bg-card p-1">
        {(['table', 'manual'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-accent' : 'text-muted-foreground')}
          >
            {m === 'table' ? 'Chọn món' : 'Tự nhập'}
          </button>
        ))}
      </div>

      {mode === 'table' ? (
        food ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{food.name}</p>
                <p className="text-xs text-muted-foreground">
                  {food.serving} ≈ {food.serving_grams} g · {food.kcal} kcal
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFood(undefined)}>
                Đổi món
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {portions.map((p) => (
                <Button key={p} size="sm" variant={grams === food.serving_grams * p ? 'default' : 'outline'} onClick={() => setGrams(food.serving_grams * p)}>
                  {p} phần
                </Button>
              ))}
            </div>
            <TextField label="Khối lượng (g)" type="number" inputMode="decimal" value={grams || ''} onChange={(e) => setGrams(Number(e.target.value))} />
            {preview && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm tabular-nums">
                {preview.kcal} kcal · đạm {preview.protein_g} g · tinh bột {preview.carbs_g} g · béo {preview.fat_g} g
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm món: pho, com tam…" aria-label="Tìm món" autoFocus />
            {foods.isPending && <p className="text-sm text-muted-foreground">Đang tải danh sách món…</p>}
            {foods.isError && <FormError message={foods.error.message} />}
            <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-lg border">
              {foods.data
                ?.filter((f) => searchMatch(f.name, search))
                .map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFood(f)
                        setGrams(f.serving_grams)
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                    >
                      <span>{f.name}</span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {f.serving} · {f.kcal} kcal
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">Không có món bạn ăn? Chuyển sang "Tự nhập".</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <TextField label="Tên món" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          </div>
          {(
            [
              ['kcal', 'Calo (kcal)'],
              ['protein_g', 'Đạm (g)'],
              ['carbs_g', 'Tinh bột (g)'],
              ['fat_g', 'Chất béo (g)'],
            ] as const
          ).map(([key, label]) => (
            <TextField key={key} label={label} type="number" inputMode="decimal" min={0} value={manual[key]} onChange={(e) => setManual({ ...manual, [key]: e.target.value })} />
          ))}
        </div>
      )}

      <FormError message={error} />
      <Button size="lg" disabled={add.isPending || (mode === 'table' ? !food || grams <= 0 : !manualValid)} onClick={submit}>
        {add.isPending ? 'Đang lưu…' : 'Thêm món'}
      </Button>
    </div>
  )
}

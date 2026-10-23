import { useState } from 'react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { mealLabels, useAddEntry, type Food, type Meal } from '@/features/nutrition/api'
import { FoodPicker } from '@/features/nutrition/FoodPicker'
import { ScanPanel } from '@/features/nutrition/ScanPanel'
import { useIsDesktop } from '@/hooks/use-media-query'
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

function EntryForm({ meal, eatenAt, onDone }: { meal: Meal; eatenAt: () => string; onDone: () => void }) {
  const add = useAddEntry()
  const [mode, setMode] = useState<'table' | 'scan' | 'manual'>('table')
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

  const manualValid = manual.name.trim() !== '' && ['kcal', 'protein_g', 'carbs_g', 'fat_g'].every((k) => manual[k as keyof typeof manual] !== '' && Number(manual[k as keyof typeof manual]) >= 0)

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div role="tablist" className="flex gap-1 rounded-xl border bg-card p-1">
        {(['table', 'scan', 'manual'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-accent' : 'text-muted-foreground')}
          >
            {{ table: 'Chọn món', scan: 'Chụp món', manual: 'Tự nhập' }[m]}
          </button>
        ))}
      </div>

      {mode === 'scan' ? (
        <ScanPanel meal={meal} eatenAt={eatenAt} onDone={onDone} />
      ) : mode === 'table' ? (
        <>
          <FoodPicker
            food={food}
            grams={grams}
            onPick={(f) => {
              setFood(f)
              setGrams(f?.serving_grams ?? 0)
            }}
            onGrams={setGrams}
          />
          {!food && <p className="text-xs text-muted-foreground">Không có món bạn ăn? Chuyển sang "Tự nhập".</p>}
        </>
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

      {mode !== 'scan' && (
        <>
          <FormError message={error} />
          <Button size="lg" disabled={add.isPending || (mode === 'table' ? !food || grams <= 0 : !manualValid)} onClick={submit}>
            {add.isPending ? 'Đang lưu…' : 'Thêm món'}
          </Button>
        </>
      )}
    </div>
  )
}

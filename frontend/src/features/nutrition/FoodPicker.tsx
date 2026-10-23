import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { foodsQuery, scaleFood, type Food } from '@/features/nutrition/api'
import { searchMatch } from '@/lib/search'

const portions = [0.5, 1, 1.5, 2]

// Search the dish table, then choose an amount (portions or grams) with a live nutrition preview.
// Used by the food log and the meal plan.
export function FoodPicker({ food, grams, onPick, onGrams }: { food?: Food; grams: number; onPick: (food?: Food) => void; onGrams: (grams: number) => void }) {
  const foods = useQuery(foodsQuery)
  const [search, setSearch] = useState('')

  if (food) {
    const preview = grams > 0 ? scaleFood(food, grams) : undefined
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium">{food.name}</p>
            <p className="text-xs text-muted-foreground">
              {food.serving} ≈ {food.serving_grams} g · {food.kcal} kcal
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onPick(undefined)}>
            Đổi món
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {portions.map((p) => (
            <Button key={p} size="sm" variant={grams === food.serving_grams * p ? 'default' : 'outline'} onClick={() => onGrams(food.serving_grams * p)}>
              {p} phần
            </Button>
          ))}
        </div>
        <TextField label="Khối lượng (g)" type="number" inputMode="decimal" value={grams || ''} onChange={(e) => onGrams(Number(e.target.value))} />
        {preview && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm tabular-nums">
            {preview.kcal} kcal · đạm {preview.protein_g} g · tinh bột {preview.carbs_g} g · béo {preview.fat_g} g
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm món: pho, com tam…" aria-label="Tìm món" autoFocus />
      {foods.isPending && <p className="text-sm text-muted-foreground">Đang tải danh sách món…</p>}
      {foods.isError && <FormError message={foods.error.message} />}
      <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-lg border">
        {foods.data
          ?.filter((f) => searchMatch(f.name, search))
          .map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onPick(f)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40">
                <span>{f.name}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {f.serving} · {f.kcal} kcal
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

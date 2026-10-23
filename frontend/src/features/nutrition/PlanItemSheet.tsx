import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { foodsQuery, mealLabels, useSavePlanItem, type Meal, type PlanItem } from '@/features/nutrition/api'
import { FoodPicker } from '@/features/nutrition/FoodPicker'
import { useIsDesktop } from '@/hooks/use-media-query'

const meals = Object.keys(mealLabels) as Meal[]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: PlanItem // undefined = add a dish
  date: string // day for a new dish
}

// Change a planned dish (dish, amount, meal, day) or add one yourself — dishes from the table only.
export function PlanItemSheet({ open, onOpenChange, item, date }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{item ? 'Sửa món trong thực đơn' : 'Thêm món vào thực đơn'}</SheetTitle>
        </SheetHeader>
        {open && <PlanItemForm key={item?.id ?? date} item={item} date={date} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function PlanItemForm({ item, date, onDone }: { item?: PlanItem; date: string; onDone: () => void }) {
  const foods = useQuery(foodsQuery)
  const save = useSavePlanItem()
  const [day, setDay] = useState(item?.date ?? date)
  const [meal, setMeal] = useState<Meal>(item?.meal ?? 'lunch')
  const [foodId, setFoodId] = useState(item?.food_id)
  const [grams, setGrams] = useState(item?.grams ?? 0)
  const [error, setError] = useState<string>()
  const food = foods.data?.find((f) => f.id === foodId)

  async function submit() {
    setError(undefined)
    try {
      await save.mutateAsync({ id: item?.id, input: { date: day, meal, food_id: foodId!, grams: Math.round(grams) } })
      toast.success(item ? 'Đã sửa món' : 'Đã thêm món')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Ngày" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <label className="flex flex-col gap-2 text-sm font-medium">
          Bữa
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="h-9 rounded-md border bg-transparent px-3 text-sm font-normal">
            {meals.map((m) => (
              <option key={m} value={m}>
                {mealLabels[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FoodPicker
        food={food}
        grams={grams}
        onPick={(f) => {
          setFoodId(f?.id)
          setGrams(f?.serving_grams ?? 0)
        }}
        onGrams={setGrams}
      />
      <FormError message={error} />
      <Button size="lg" disabled={save.isPending || !food || grams < 10 || !day} onClick={submit}>
        {save.isPending ? 'Đang lưu…' : item ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
      </Button>
    </div>
  )
}

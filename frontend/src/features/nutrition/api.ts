import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { dateKey, fromDateKey } from '@/lib/format'

export type Goal = 'cut' | 'maintain' | 'bulk'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Targets = { bmr: number; tdee: number; kcal: number; protein_g: number }
export type NutritionProfile = {
  goal: Goal
  sex: 'male' | 'female'
  birth_year: number
  weight_kg: number
  height_cm: number
  workouts_per_week: number
  targets: Targets
}
export type ProfileInput = Omit<NutritionProfile, 'targets'>

type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export type Food = Macros & { id: number; name: string; serving: string; serving_grams: number }
export type FoodEntry = Macros & {
  id: number
  eaten_at: string
  meal: Meal
  food_id: number | null
  name: string
  grams: number | null
  source: 'table' | 'manual' | 'scan'
  components: Component[] | null
}
// An ingredient of a scanned plate. estimated = not in the table (AI numbers).
export type Component = Macros & { name: string; food_id: number | null; grams: number; estimated: boolean }

export type EntryInput =
  | { eaten_at: string; meal: Meal; food_id: number; grams: number }
  | (Macros & { eaten_at: string; meal: Meal; name: string; grams: null })
  // A scanned plate: one named dish; the server totals the components (table ones from the table).
  | { eaten_at: string; meal: Meal; name: string; components: Omit<Component, 'estimated'>[] }

// A dish recognised in a photo: food_id = from the table (table numbers); null = Gemini's estimate.
export type ScanItem = Macros & { food_id: number | null; name: string; grams: number; estimated: boolean; confidence: number }

// A dish of the confirmed weekly plan; food_entry_id is set once it was logged with "Đã ăn".
export type PlanItem = Macros & {
  id: number
  date: string
  meal: Meal
  food_id: number
  name: string
  grams: number
  est_cost: string | null
  food_entry_id: number | null
}
export type ProposedItem = Omit<PlanItem, 'id' | 'food_entry_id'>
export type MealPlanProposal = {
  id: number
  payload: { week_start: string; budget_vnd: string | null; total_cost_vnd: string; items: ProposedItem[] }
}

type DayResponse = { data: FoodEntry[]; meta: { date: string; totals: Macros; targets: Targets | null; plan?: PlanItem[] } }

export const nutritionKeys = { all: ['nutrition'] as const }

export const profileQuery = queryOptions({
  queryKey: ['nutrition', 'profile'],
  queryFn: () => api<{ data: NutritionProfile | null }>('/nutrition/profile').then((r) => r.data),
})

export const foodsQuery = queryOptions({
  queryKey: ['nutrition', 'foods'],
  queryFn: () => api<{ data: Food[] }>('/foods').then((r) => r.data),
  staleTime: Infinity, // reference data, changes only with a migration
})

export const dayQuery = (date: string) =>
  queryOptions({
    queryKey: ['nutrition', 'day', date],
    queryFn: () => api<DayResponse>(`/food-entries?date=${date}`),
  })

export const mealPlanQuery = (week: string) =>
  queryOptions({
    queryKey: ['nutrition', 'plan', week],
    queryFn: () => api<{ data: PlanItem[]; meta: { week_start: string; budget_vnd: string | null } }>(`/meal-plan?week=${week}`),
  })

// Monday of the week containing a YYYY-MM-DD day (weeks start on Monday, like the server).
export const mondayOf = (key: string) => {
  const d = fromDateKey(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dateKey(d)
}

// AI only proposes: nothing is saved until the proposal is confirmed (spec §15.4).
export const useGenerateMealPlan = () =>
  useMutation({
    mutationFn: (weekStart: string) =>
      api<{ data: MealPlanProposal }>('/ai/meal-plan', { method: 'POST', body: { week_start: weekStart } }).then((r) => r.data),
  })

// Nothing is saved by a scan: the user reviews the plate, then logs it as one entry with useAddEntry.
export const useFoodScan = () =>
  useMutation({
    mutationFn: (image: string) => api<{ data: { name: string; items: ScanItem[] } }>('/ai/food-scan', { method: 'POST', body: { image } }).then((r) => r.data),
  })

// Profile, entries and totals all depend on each other: refresh the whole feature after any write.
function useNutritionMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: nutritionKeys.all }) })
}

export const useSaveProfile = () => useNutritionMutation((input: ProfileInput) => api('/nutrition/profile', { method: 'PUT', body: input }))
export const useAddEntry = () => useNutritionMutation((input: EntryInput) => api('/food-entries', { method: 'POST', body: input }))
export const useCopyDay = () =>
  useNutritionMutation((days: { from: string; to: string }) =>
    api<{ data: { copied: number } }>('/food-entries/copy', { method: 'POST', body: days }).then((r) => r.data.copied),
  )
export const useConfirmMealPlan = () => useNutritionMutation((proposalId: number) => api(`/ai/proposals/${proposalId}/confirm`, { method: 'POST' }))
export type PlanItemInput = { date: string; meal: Meal; food_id: number; grams: number }
// After confirming, the plan is the user's: change a dish (id) or add one (no id).
export const useSavePlanItem = () =>
  useNutritionMutation(({ id, input }: { id?: number; input: PlanItemInput }) =>
    api(id ? `/meal-plan-items/${id}` : '/meal-plan-items', { method: id ? 'PUT' : 'POST', body: input }),
  )
export const useEatPlanItem =() => useNutritionMutation((id: number) => api(`/meal-plan-items/${id}/eat`, { method: 'POST' }))
export const useDeletePlanItem = () => useNutritionMutation((id: number) => api(`/meal-plan-items/${id}`, { method: 'DELETE' }))
export const useDeleteEntry = () => useNutritionMutation((id: number) => api(`/food-entries/${id}`, { method: 'DELETE' }))

/** Same scaling the server applies, for the live preview while picking grams. */
export const scaleFood = (food: Food, grams: number): Macros => {
  const f = grams / food.serving_grams
  const r = (v: number) => Math.round(v * f * 10) / 10
  return { kcal: r(food.kcal), protein_g: r(food.protein_g), carbs_g: r(food.carbs_g), fat_g: r(food.fat_g) }
}

export const mealLabels: Record<Meal, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối', snack: 'Ăn vặt' }
export const goalLabels: Record<Goal, string> = { cut: 'Giảm mỡ', maintain: 'Giữ cân', bulk: 'Tăng cơ' }

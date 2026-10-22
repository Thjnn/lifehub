import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

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
}
export type EntryInput = { eaten_at: string; meal: Meal; food_id: number; grams: number } | (Macros & { eaten_at: string; meal: Meal; name: string; grams: null })

type DayResponse = { data: FoodEntry[]; meta: { date: string; totals: Macros; targets: Targets | null } }

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

// Profile, entries and totals all depend on each other: refresh the whole feature after any write.
function useNutritionMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: nutritionKeys.all }) })
}

export const useSaveProfile = () => useNutritionMutation((input: ProfileInput) => api('/nutrition/profile', { method: 'PUT', body: input }))
export const useAddEntry = () => useNutritionMutation((input: EntryInput) => api('/food-entries', { method: 'POST', body: input }))
export const useDeleteEntry = () => useNutritionMutation((id: number) => api(`/food-entries/${id}`, { method: 'DELETE' }))

/** Same scaling the server applies, for the live preview while picking grams. */
export const scaleFood = (food: Food, grams: number): Macros => {
  const f = grams / food.serving_grams
  const r = (v: number) => Math.round(v * f * 10) / 10
  return { kcal: r(food.kcal), protein_g: r(food.protein_g), carbs_g: r(food.carbs_g), fat_g: r(food.fat_g) }
}

export const mealLabels: Record<Meal, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối', snack: 'Ăn vặt' }
export const goalLabels: Record<Goal, string> = { cut: 'Giảm mỡ', maintain: 'Giữ cân', bulk: 'Tăng cơ' }

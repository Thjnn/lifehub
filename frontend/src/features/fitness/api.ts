import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// Workouts and body measurements (spec §15.4). Online-only, like nutrition.

export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio'
export type Exercise = { id: number; name: string; kind: ExerciseKind; muscle_group: string | null; is_custom: boolean }

type Effort = { reps: number | null; weight_kg: number | null; duration_min: number | null; distance_km: number | null }
export type WorkoutSet = Effort & { exercise_id: number; exercise_name: string; kind: ExerciseKind }
export type Workout = { id: number; performed_at: string; duration_min: number | null; note: string | null; event_id: number | null; sets: WorkoutSet[] }
export type WorkoutInput = Pick<Workout, 'performed_at' | 'duration_min' | 'note' | 'event_id'> & { sets: (Effort & { exercise_id: number })[] }

export type Measurement = { id: number; measured_on: string; weight_kg: number; waist_cm: number | null; body_fat_pct: number | null }
export type MeasurementInput = Pick<Measurement, 'weight_kg' | 'waist_cm' | 'body_fat_pct'>

export const exercisesQuery = queryOptions({
  queryKey: ['fitness', 'exercises'],
  queryFn: () => api<{ data: Exercise[] }>('/exercises').then((r) => r.data),
})

export const workoutsQuery = queryOptions({
  queryKey: ['fitness', 'workouts'],
  queryFn: () => api<{ data: Workout[] }>('/workouts').then((r) => r.data),
})

export const measurementsQuery = queryOptions({
  queryKey: ['fitness', 'measurements'],
  queryFn: () => api<{ data: Measurement[] }>('/body-measurements').then((r) => r.data),
})

// A new weight also updates the nutrition profile (targets), so refresh both features.
function useFitnessMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([['fitness'], ['nutrition']].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useSaveWorkout = () =>
  useFitnessMutation(({ id, input }: { id?: number; input: WorkoutInput }) =>
    api(id ? `/workouts/${id}` : '/workouts', { method: id ? 'PUT' : 'POST', body: input }),
  )
export const useDeleteWorkout = () => useFitnessMutation((id: number) => api(`/workouts/${id}`, { method: 'DELETE' }))
export const useCreateExercise = () =>
  useFitnessMutation((input: { name: string; kind: ExerciseKind }) => api<{ data: Exercise }>('/exercises', { method: 'POST', body: input }).then((r) => r.data))
export const useSaveMeasurement = () =>
  useFitnessMutation(({ date, input }: { date: string; input: MeasurementInput }) => api(`/body-measurements/${date}`, { method: 'PUT', body: input }))
export const useDeleteMeasurement = () => useFitnessMutation((id: number) => api(`/body-measurements/${id}`, { method: 'DELETE' }))

export const kindLabels: Record<ExerciseKind, string> = { strength: 'Tạ', bodyweight: 'Trọng lượng cơ thể', cardio: 'Cardio' }

// Consecutive sets of the same exercise, as shown and edited: [{ exercise, sets }].
export function groupSets<T extends { exercise_id: number }>(sets: T[]) {
  const groups: { exercise_id: number; sets: T[] }[] = []
  for (const set of sets) {
    const last = groups.at(-1)
    if (last?.exercise_id === set.exercise_id) last.sets.push(set)
    else groups.push({ exercise_id: set.exercise_id, sets: [set] })
  }
  return groups
}

const num = (v: number) => String(Math.round(v * 100) / 100)

// One exercise's sets in a line: "3×10 @ 40 kg", "10/8/6 @ 40–50 kg", "20 phút · 3.5 km".
export function summarizeSets(sets: Effort[]) {
  if (sets.every((s) => s.reps === null)) {
    const minutes = sets.reduce((sum, s) => sum + (s.duration_min ?? 0), 0)
    const km = sets.reduce((sum, s) => sum + (s.distance_km ?? 0), 0)
    return [minutes && `${num(minutes)} phút`, km && `${num(km)} km`].filter(Boolean).join(' · ')
  }
  const reps = sets.map((s) => s.reps ?? 0)
  const repsText = reps.every((r) => r === reps[0]) ? `${sets.length}×${reps[0]}` : reps.join('/')
  const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w !== null && w > 0)
  if (weights.length === 0) return repsText
  const [lo, hi] = [Math.min(...weights), Math.max(...weights)]
  return `${repsText} @ ${lo === hi ? num(lo) : `${num(lo)}–${num(hi)}`} kg`
}

// The sets of an exercise in the most recent other workout: the "last time" hint (newest first list).
export function lastSetsFor(workouts: Workout[], exerciseId: number, excludeId?: number) {
  const previous = workouts.find((w) => w.id !== excludeId && w.sets.some((s) => s.exercise_id === exerciseId))
  return previous?.sets.filter((s) => s.exercise_id === exerciseId)
}

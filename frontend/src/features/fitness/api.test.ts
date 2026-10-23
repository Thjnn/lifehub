import { describe, expect, it } from 'vitest'
import { groupSets, lastSetsFor, summarizeSets, type Workout } from './api'

const set = (reps: number | null, weight_kg: number | null = null, duration_min: number | null = null, distance_km: number | null = null) => ({ reps, weight_kg, duration_min, distance_km })

describe('summarizeSets', () => {
  it('collapses equal reps and shows the weight range', () => {
    expect(summarizeSets([set(10, 40), set(10, 40), set(10, 40)])).toBe('3×10 @ 40 kg')
    expect(summarizeSets([set(10, 40), set(8, 45), set(6, 50)])).toBe('10/8/6 @ 40–50 kg')
    expect(summarizeSets([set(15), set(12)])).toBe('15/12')
  })

  it('adds up cardio minutes and distance', () => {
    expect(summarizeSets([set(null, null, 20, 3.5), set(null, null, 10, 1.25)])).toBe('30 phút · 4.75 km')
    expect(summarizeSets([set(null, null, 45)])).toBe('45 phút')
  })
})

describe('groupSets / lastSetsFor', () => {
  it('groups consecutive sets and finds the previous workout with the exercise', () => {
    expect(groupSets([{ exercise_id: 1 }, { exercise_id: 1 }, { exercise_id: 2 }, { exercise_id: 1 }]).map((g) => [g.exercise_id, g.sets.length])).toEqual([
      [1, 2],
      [2, 1],
      [1, 1],
    ])

    const workout = (id: number, exercise_id: number, reps: number) =>
      ({ id, sets: [{ exercise_id, exercise_name: '', kind: 'strength', ...set(reps, 40) }] }) as unknown as Workout
    const newestFirst = [workout(3, 2, 5), workout(2, 1, 10), workout(1, 1, 8)]
    expect(lastSetsFor(newestFirst, 1)?.[0].reps).toBe(10)
    expect(lastSetsFor(newestFirst, 1, 2)?.[0].reps).toBe(8) // editing workout 2: compare with the one before
    expect(lastSetsFor(newestFirst, 9)).toBeUndefined()
  })
})

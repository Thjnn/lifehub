<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Fitness\WorkoutRequest;
use App\Models\BodyMeasurement;
use App\Models\Exercise;
use App\Models\Workout;
use App\Models\WorkoutSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Workouts and body measurements (spec §15.4). Online-only, like nutrition. No AI here: "last time" hints are
 * just the user's own history, filtered on the client.
 */
class FitnessController extends Controller
{
    // ~30 system exercises + the user's own: sent whole, searched on the client.
    public function exercises(Request $request): JsonResponse
    {
        return response()->json(['data' => Exercise::visibleTo($request->user())->orderBy('name')->get()->map(fn (Exercise $e) => $this->exerciseData($e))]);
    }

    public function storeExercise(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'kind' => ['required', Rule::in(['strength', 'bodyweight', 'cardio'])],
            'muscle_group' => ['nullable', 'string', 'max:20'],
        ]);

        return response()->json(['data' => $this->exerciseData($request->user()->exercises()->create($data))], 201);
    }

    public function destroyExercise(Exercise $exercise): Response
    {
        Gate::authorize('delete', $exercise);
        $count = WorkoutSet::where('exercise_id', $exercise->id)->count();
        abort_if($count > 0, 409, "Bài tập đang có trong {$count} set đã ghi, không xoá được.");

        $exercise->delete();

        return response()->noContent();
    }

    // GET /workouts — the 30 most recent, with their sets
    public function workouts(Request $request): JsonResponse
    {
        $workouts = $request->user()->workouts()->with('sets.exercise')->latest('performed_at')->limit(30)->get();

        return response()->json(['data' => $workouts->map(fn (Workout $w) => $this->workoutData($w))]);
    }

    public function storeWorkout(WorkoutRequest $request): JsonResponse
    {
        $workout = DB::transaction(function () use ($request) {
            $workout = $request->user()->workouts()->create($request->safe()->except('sets'));
            $this->saveSets($workout, $request->validated('sets'));

            return $workout;
        });

        return response()->json(['data' => $this->workoutData($workout->load('sets.exercise'))], 201);
    }

    public function updateWorkout(WorkoutRequest $request, Workout $workout): JsonResponse
    {
        Gate::authorize('update', $workout);

        DB::transaction(function () use ($request, $workout) {
            // PUT = the full workout: an optional field left out is cleared.
            $workout->update($request->safe()->except('sets') + ['duration_min' => null, 'note' => null, 'event_id' => null]);
            $workout->sets()->delete();
            $this->saveSets($workout, $request->validated('sets'));
        });

        return response()->json(['data' => $this->workoutData($workout->load('sets.exercise'))]);
    }

    public function destroyWorkout(Workout $workout): Response
    {
        Gate::authorize('delete', $workout);
        $workout->delete(); // sets cascade

        return response()->noContent();
    }

    // GET /body-measurements — newest first (about a year of daily weigh-ins)
    public function measurements(Request $request): JsonResponse
    {
        $rows = $request->user()->bodyMeasurements()->orderByDesc('measured_on')->limit(365)->get();

        return response()->json(['data' => $rows->map(fn (BodyMeasurement $m) => $this->measurementData($m))]);
    }

    /**
     * PUT /body-measurements/{date} — one row per day (a second weigh-in the same day replaces the first).
     * The newest weight also updates the nutrition profile, so calorie/protein targets follow it.
     */
    public function upsertMeasurement(Request $request, string $date): JsonResponse
    {
        $data = $request->validate([
            'weight_kg' => ['required', 'numeric', 'between:20,300'],
            'waist_cm' => ['nullable', 'numeric', 'between:30,250'],
            'body_fat_pct' => ['nullable', 'numeric', 'between:2,75'],
        ]);
        $user = $request->user();

        // whereDate: SQLite (tests) stores dates with a time part, Postgres as DATE.
        $measurement = $user->bodyMeasurements()->whereDate('measured_on', $date)->first() ?? $user->bodyMeasurements()->make(['measured_on' => $date]);
        $created = ! $measurement->exists;
        $measurement->fill($data)->save();

        if (! $user->bodyMeasurements()->whereDate('measured_on', '>', $date)->exists()) {
            $user->nutritionProfile?->update(['weight_kg' => $data['weight_kg']]);
        }

        return response()->json(['data' => $this->measurementData($measurement)], $created ? 201 : 200);
    }

    public function destroyMeasurement(BodyMeasurement $measurement): Response
    {
        Gate::authorize('delete', $measurement);
        $measurement->delete();

        return response()->noContent();
    }

    /**
     * @param  list<array<string, mixed>>  $sets
     */
    private function saveSets(Workout $workout, array $sets): void
    {
        foreach (array_values($sets) as $position => $set) {
            $workout->sets()->create([
                'user_id' => $workout->user_id,
                'exercise_id' => $set['exercise_id'],
                'position' => $position,
                'reps' => $set['reps'] ?? null,
                'weight_kg' => $set['weight_kg'] ?? null,
                'duration_min' => $set['duration_min'] ?? null,
                'distance_km' => $set['distance_km'] ?? null,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function exerciseData(Exercise $e): array
    {
        return ['id' => $e->id, 'name' => $e->name, 'kind' => $e->kind, 'muscle_group' => $e->muscle_group, 'is_custom' => $e->user_id !== null];
    }

    /**
     * @return array<string, mixed>
     */
    private function workoutData(Workout $w): array
    {
        return [
            'id' => $w->id,
            'performed_at' => $w->performed_at->toIso8601String(),
            'duration_min' => $w->duration_min,
            'note' => $w->note,
            'event_id' => $w->event_id,
            'sets' => $w->sets->map(fn (WorkoutSet $s) => [
                'exercise_id' => $s->exercise_id,
                'exercise_name' => $s->exercise->name,
                'kind' => $s->exercise->kind,
                ...$s->only(['reps', 'weight_kg', 'duration_min', 'distance_km']),
            ])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function measurementData(BodyMeasurement $m): array
    {
        return ['id' => $m->id, 'measured_on' => $m->measured_on->toDateString(), ...$m->only(['weight_kg', 'waist_cm', 'body_fat_pct'])];
    }
}

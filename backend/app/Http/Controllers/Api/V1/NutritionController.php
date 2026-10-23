<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\NutritionGoal;
use App\Http\Controllers\Controller;
use App\Http\Requests\Nutrition\FoodEntryRequest;
use App\Http\Resources\MealPlanItemResource;
use App\Models\Food;
use App\Models\FoodEntry;
use App\Models\NutritionProfile;
use App\Models\User;
use App\Services\Nutrition\NutritionTargets;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Nutrition (spec §15.4): profile + formula targets, the reference dish table, and the daily food log.
 */
class NutritionController extends Controller
{
    public function profile(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->profileData($request->user()->nutritionProfile)]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'goal' => ['required', Rule::enum(NutritionGoal::class)],
            'sex' => ['required', 'in:male,female'],
            'birth_year' => ['required', 'integer', 'between:'.(now()->year - 100).','.(now()->year - 10)],
            'weight_kg' => ['required', 'numeric', 'between:20,300'],
            'height_cm' => ['required', 'integer', 'between:100,250'],
            'workouts_per_week' => ['required', 'integer', 'between:0,14'],
        ]);

        $profile = $request->user()->nutritionProfile()->updateOrCreate([], $data);

        return response()->json(['data' => $this->profileData($profile)]);
    }

    public function foods(): JsonResponse
    {
        // ~40 rows: sent whole, searched on the client.
        return response()->json(['data' => Food::orderBy('name')->get(['id', 'name', 'serving', 'serving_grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'])]);
    }

    /**
     * GET /food-entries?date=Y-m-d — one day in the user's timezone, with totals and targets.
     */
    public function entries(Request $request): JsonResponse
    {
        $user = $request->user();
        $date = $request->validate(['date' => ['sometimes', 'date_format:Y-m-d']])['date'] ?? now($this->timezone($request))->toDateString();
        $entries = $this->dayEntries($request, $date)->orderBy('eaten_at')->get();

        $total = fn (string $field) => round($entries->sum($field), 1);

        return response()->json([
            'data' => $entries->map(fn (FoodEntry $e) => $this->entryData($e)),
            'meta' => [
                'date' => $date,
                'totals' => ['kcal' => $total('kcal'), 'protein_g' => $total('protein_g'), 'carbs_g' => $total('carbs_g'), 'fat_g' => $total('fat_g')],
                'targets' => $this->profileData($user->nutritionProfile)['targets'] ?? null,
                // The day's planned dishes, for the "Đã ăn" buttons.
                'plan' => MealPlanItemResource::collection($user->mealPlanItems()->with('food')->whereDate('date', $date)->orderBy('id')->get()),
            ],
        ]);
    }

    public function storeEntry(FoodEntryRequest $request): JsonResponse
    {
        $entry = $request->user()->foodEntries()->create($this->entryAttributes($request));

        return response()->json(['data' => $this->entryData($entry)], 201);
    }

    /**
     * POST /food-entries/copy {from, to} — log a day's meals again (same dishes, meals and times of day).
     * Only into an empty day, so a double tap can't log everything twice.
     */
    public function copyDay(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'different:from'],
        ]);

        abort_if($this->dayEntries($request, $data['to'])->exists(), 409, 'Ngày này đã có món, không chép đè.');

        $timezone = $this->timezone($request);
        $days = (int) Carbon::parse($data['from'])->diffInDays(Carbon::parse($data['to']), false);
        // Shift by calendar days in the user's timezone, so 07:30 stays 07:30 locally.
        $copies = $this->dayEntries($request, $data['from'])->get()->map(fn (FoodEntry $e) => [
            ...$e->only(['meal', 'food_id', 'name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'source']),
            'eaten_at' => $e->eaten_at->copy()->setTimezone($timezone)->addDays($days)->utc(),
        ]);
        abort_if($copies->isEmpty(), 422, 'Ngày nguồn chưa có món nào.');

        $request->user()->foodEntries()->createMany($copies);

        return response()->json(['data' => ['copied' => $copies->count()]], 201);
    }

    public function destroyEntry(FoodEntry $entry): Response
    {
        Gate::authorize('delete', $entry);
        $entry->delete();

        return response()->noContent();
    }

    private function timezone(Request $request): string
    {
        return $request->user()->settings?->timezone ?? config('app.timezone');
    }

    /**
     * The user's entries on one calendar day of their timezone.
     *
     * @return HasMany<FoodEntry, User>
     */
    private function dayEntries(Request $request, string $date): HasMany
    {
        $day = Carbon::createFromFormat('Y-m-d', $date, $this->timezone($request))->startOfDay();

        return $request->user()->foodEntries()->whereBetween('eaten_at', [$day->copy()->utc(), $day->copy()->endOfDay()->utc()]);
    }

    /**
     * A dish from the table is scaled by grams on the server, so the client can't send made-up numbers for it.
     *
     * @return array<string, mixed>
     */
    private function entryAttributes(FoodEntryRequest $request): array
    {
        $data = $request->validated();
        $base = ['eaten_at' => $data['eaten_at'], 'meal' => $data['meal'], 'grams' => $data['grams'] ?? null];

        if ($food = Food::find($data['food_id'] ?? null)) {
            return $base + ['food_id' => $food->id, 'name' => $food->name, 'source' => 'table'] + $food->scaled($data['grams']);
        }

        return $base + ['food_id' => null, 'source' => 'manual'] + array_intersect_key($data, array_flip(['name', 'kcal', 'protein_g', 'carbs_g', 'fat_g']));
    }

    /**
     * @return array<string, mixed>
     */
    private function entryData(FoodEntry $e): array
    {
        return [
            'id' => $e->id,
            'eaten_at' => $e->eaten_at?->toIso8601String(),
            'meal' => $e->meal,
            'food_id' => $e->food_id,
            'name' => $e->name,
            'grams' => $e->grams,
            'kcal' => $e->kcal,
            'protein_g' => $e->protein_g,
            'carbs_g' => $e->carbs_g,
            'fat_g' => $e->fat_g,
            'source' => $e->source,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function profileData(?NutritionProfile $p): ?array
    {
        return $p ? $p->only(['goal', 'sex', 'birth_year', 'weight_kg', 'height_cm', 'workouts_per_week']) + ['targets' => NutritionTargets::for($p, now()->year)] : null;
    }
}

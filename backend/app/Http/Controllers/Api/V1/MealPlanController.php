<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Nutrition\MealPlanItemRequest;
use App\Http\Resources\MealPlanItemResource;
use App\Models\MealPlanItem;
use App\Services\Nutrition\MealPlanner;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * The weekly meal plan (spec §15.4). The AI only proposes (AiController::mealPlan → confirm); after that the plan is
 * the user's own: they can change, add or remove dishes here.
 */
class MealPlanController extends Controller
{
    public function __construct(private MealPlanner $planner) {}

    // GET /meal-plan?week=Y-m-d — any day of the week; normalized to its Monday
    public function index(Request $request): JsonResponse
    {
        $week = $request->validate(['week' => ['required', 'date_format:Y-m-d']])['week'];
        $weekStart = Carbon::parse($week)->startOfWeek(Carbon::MONDAY);

        return response()->json([
            'data' => MealPlanItemResource::collection($this->planner->week($request->user(), $weekStart)->with('food')->orderBy('date')->orderBy('id')->get()),
            'meta' => ['week_start' => $weekStart->toDateString(), 'budget_vnd' => $this->planner->weeklyBudget($request->user(), $weekStart)],
        ]);
    }

    // POST /meal-plan-items — the user adds a dish themselves (no price estimate)
    public function store(MealPlanItemRequest $request): JsonResponse
    {
        $item = $request->user()->mealPlanItems()->create($request->validated());

        return (new MealPlanItemResource($item->load('food')))->response()->setStatusCode(201);
    }

    // PUT /meal-plan-items/{item} — change the dish, amount, meal or day
    public function update(MealPlanItemRequest $request, MealPlanItem $item): MealPlanItemResource
    {
        Gate::authorize('update', $item);
        abort_if($item->food_entry_id !== null, 409, 'Món này đã ăn — sửa trong nhật ký.');

        $data = $request->validated();
        // Same dish: the AI's price estimate scales with the amount. Another dish: no estimate.
        $estCost = $item->est_cost !== null && (int) $data['food_id'] === $item->food_id
            ? Money::format(bcdiv(bcmul($item->est_cost, (string) $data['grams'], 2), (string) $item->grams, 2))
            : null;
        $item->update([...$data, 'est_cost' => $estCost]);

        return new MealPlanItemResource($item->load('food'));
    }

    // POST /meal-plan-items/{item}/eat
    public function eat(Request $request, MealPlanItem $item): JsonResponse
    {
        Gate::authorize('update', $item);
        abort_if($item->food_entry_id !== null, 409, 'Món này đã được ghi vào nhật ký.');

        $entry = $this->planner->eat($request->user(), $item);

        return response()->json(['data' => ['food_entry_id' => $entry->id]], 201);
    }

    public function destroy(MealPlanItem $item): Response
    {
        Gate::authorize('delete', $item);
        $item->delete(); // an entry already logged from it stays in the log

        return response()->noContent();
    }
}

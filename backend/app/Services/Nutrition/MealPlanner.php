<?php

namespace App\Services\Nutrition;

use App\Enums\Meal;
use App\Models\AiActionProposal;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Food;
use App\Models\FoodEntry;
use App\Models\MealPlanItem;
use App\Models\User;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Gemini;
use App\Services\Finance\FinanceReport;
use App\Services\Finance\MonthRange;
use App\Support\Money;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Weekly meal plan (spec §15.4): Gemini picks dishes from the `foods` table only → a proposal the user confirms →
 * plan items → one tap "Đã ăn" logs a food entry with the table's numbers. The model never supplies nutrition.
 */
class MealPlanner
{
    // When "Đã ăn" logs a planned dish, it is logged at the usual time of that meal.
    private const MEAL_TIMES = ['breakfast' => '07:30', 'lunch' => '12:00', 'dinner' => '19:00', 'snack' => '15:30'];

    private const MAX_ITEMS = 70;

    private const SCHEMA = ['type' => 'OBJECT', 'properties' => ['items' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => [
        'day' => ['type' => 'INTEGER', 'description' => '0 = Monday … 6 = Sunday'],
        'meal' => ['type' => 'STRING', 'enum' => ['breakfast', 'lunch', 'dinner', 'snack']],
        'food_id' => ['type' => 'INTEGER', 'description' => 'id from the dish list'],
        'grams' => ['type' => 'INTEGER'],
        'cost' => ['type' => 'INTEGER', 'description' => 'Estimated price in VND'],
    ], 'required' => ['day', 'meal', 'food_id', 'grams', 'cost']]]], 'required' => ['items']];

    public function __construct(private Gemini $gemini, private FinanceReport $report) {}

    /**
     * Ask Gemini for a week of meals, keep only valid rows, store them as a pending proposal.
     *
     * @throws AiUnavailable
     */
    public function propose(User $user, Carbon $weekStart): AiActionProposal
    {
        $profile = $user->nutritionProfile;
        abort_unless($profile, 422, 'Hãy thiết lập hồ sơ dinh dưỡng trước để có mục tiêu calo.');
        $targets = NutritionTargets::for($profile, now()->year);
        $budget = $this->weeklyBudget($user, $weekStart);
        $foods = Food::all()->keyBy('id');

        $dishes = $foods->map(fn (Food $f) => "{$f->id}|{$f->name}|{$f->serving}|{$f->serving_grams} g|{$f->kcal} kcal|{$f->protein_g} g protein")->implode("\n");
        $prompt = implode("\n", [
            "Lập thực đơn 7 ngày, bắt đầu thứ Hai {$weekStart->toDateString()}.",
            "Mục tiêu mỗi ngày: khoảng {$targets['kcal']} kcal (±10%), ít nhất ".round($targets['protein_g'] * 0.9).' g protein.',
            $budget ? "Tổng chi phí cả tuần không vượt quá {$budget} VND." : 'Không có giới hạn ngân sách, nhưng ưu tiên món bình dân.',
            'Mỗi ngày có bữa sáng, trưa, tối; ăn vặt tuỳ chọn. Một bữa có thể gồm nhiều món (vd. cơm trắng + thịt kho + rau).',
            'Đa dạng: một món chính không lặp quá 2 lần/tuần. grams thường là bội số của khẩu phần.',
            'cost = giá ước tính bằng VND cho đúng lượng đó (giá quán bình dân / tự nấu ở Việt Nam).',
            'Chỉ dùng food_id trong danh sách sau (id|tên|khẩu phần|gram|kcal|protein mỗi khẩu phần):',
            $dishes,
        ]);

        $result = $this->gemini->generate(
            'Bạn là chuyên gia dinh dưỡng, lập thực đơn món Việt thực tế, dễ mua, dễ nấu.',
            [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            schema: self::SCHEMA,
        );
        $json = json_decode(implode('', array_column(array_filter($result['parts'], fn ($p) => isset($p['text'])), 'text')), true);

        $items = collect(is_array($json['items'] ?? null) ? $json['items'] : [])
            ->map(fn ($row) => is_array($row) ? $this->validItem($row, $weekStart, $foods) : null)
            ->filter()
            ->take(self::MAX_ITEMS)
            ->sortBy(fn (array $i) => $i['date'].array_search($i['meal'], array_keys(self::MEAL_TIMES)))
            ->values();
        if ($items->isEmpty()) {
            throw new AiUnavailable('AI chưa tạo được thực đơn hợp lệ, bạn thử lại nhé.');
        }

        $proposal = new AiActionProposal([
            'action_type' => 'create_meal_plan',
            'payload' => [
                'week_start' => $weekStart->toDateString(),
                'budget_vnd' => $budget,
                'total_cost_vnd' => Money::format($items->reduce(fn (string $sum, array $i) => bcadd($sum, $i['est_cost'], 2), '0')),
                'items' => $items->all(),
            ],
            'status' => 'pending',
            'expires_at' => now()->addDay(),
        ]);
        $proposal->user_id = $user->id;
        $proposal->save();

        return $proposal;
    }

    /**
     * Confirmed: replace the week's not-yet-eaten items with the proposal's.
     *
     * @param  array<string, mixed>  $payload
     * @return array{type: string, count: int}
     */
    public function apply(User $user, array $payload): array
    {
        $weekStart = Carbon::parse($payload['week_start']);
        $existing = Food::whereIn('id', array_column($payload['items'], 'food_id'))->pluck('id')->flip();

        $this->week($user, $weekStart)->whereNull('food_entry_id')->delete();
        $items = collect($payload['items'])->filter(fn (array $i) => isset($existing[$i['food_id']]));
        $items->each(fn (array $i) => $user->mealPlanItems()->create([
            'date' => $i['date'], 'meal' => $i['meal'], 'food_id' => $i['food_id'], 'grams' => $i['grams'], 'est_cost' => $i['est_cost'],
        ]));

        return ['type' => 'meal_plan', 'count' => $items->count()];
    }

    /**
     * "Đã ăn": log the planned dish with the table's numbers, at the usual time of that meal.
     */
    public function eat(User $user, MealPlanItem $item): FoodEntry
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $food = $item->food;

        return DB::transaction(function () use ($user, $item, $food, $timezone) {
            $entry = $user->foodEntries()->create([
                'eaten_at' => Carbon::parse($item->date->toDateString().' '.self::MEAL_TIMES[$item->meal->value], $timezone)->utc(),
                'meal' => $item->meal,
                'food_id' => $food->id,
                'name' => $food->name,
                'grams' => $item->grams,
                'source' => 'table',
            ] + $food->scaled($item->grams));

            // Conditional update: a double tap can't log the same dish twice (the loser rolls back).
            $claimed = MealPlanItem::whereKey($item->id)->whereNull('food_entry_id')->update(['food_entry_id' => $entry->id]);
            abort_if($claimed === 0, 409, 'Món này đã được ghi vào nhật ký.');

            return $entry;
        });
    }

    /**
     * What's left of this month's "Ăn uống" budget, spread over the remaining days, for 7 days. Null = no budget set.
     */
    public function weeklyBudget(User $user, Carbon $weekStart): ?string
    {
        $categoryId = Category::whereNull('user_id')->where('name', 'Ăn uống')->value('id');
        $month = $weekStart->format('Y-m');
        $budget = Budget::where('user_id', $user->id)->where('category_id', $categoryId)->whereDate('period_start', "{$month}-01")->first();
        if (! $budget) {
            return null;
        }

        $spent = $this->report->expensesByCategory($user, MonthRange::for($user, $month))->pluck('amount', 'category_id')[$categoryId] ?? '0';
        $remaining = bcsub(Money::format($budget->amount), Money::format($spent), 2);
        if (bccomp($remaining, '0', 2) <= 0) {
            return '0.00';
        }

        // ponytail: assumes the rest of the month is spent evenly; a week spanning two months uses the first month's budget.
        // Count calendar days (today in the user's timezone, as a plain date), so a UTC offset can't add a day.
        $today = Carbon::parse(now($user->settings?->timezone ?? config('app.timezone'))->toDateString());
        $from = $weekStart->copy()->max($today);
        $daysLeft = max(1, (int) $from->diffInDays($weekStart->copy()->endOfMonth()->startOfDay()) + 1);

        return Money::format(bcdiv(bcmul($remaining, '7', 2), (string) $daysLeft, 2));
    }

    /**
     * @return HasMany<MealPlanItem, User>
     */
    public function week(User $user, Carbon $weekStart)
    {
        return $user->mealPlanItems()
            ->whereDate('date', '>=', $weekStart->toDateString())
            ->whereDate('date', '<=', $weekStart->copy()->addDays(6)->toDateString());
    }

    /**
     * One row from the model, checked: known dish, sane amount, inside the week. Anything else is dropped.
     *
     * @param  array<string, mixed>  $row
     * @param  Collection<int, Food>  $foods
     * @return array<string, mixed>|null
     */
    private function validItem(array $row, Carbon $weekStart, Collection $foods): ?array
    {
        $day = filter_var($row['day'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 6]]);
        $meal = Meal::tryFrom((string) ($row['meal'] ?? ''));
        $food = $foods->get((int) ($row['food_id'] ?? 0));
        $grams = (int) ($row['grams'] ?? 0);
        if ($day === false || ! $meal || ! $food || $grams < 10 || $grams > 1500) {
            return null;
        }

        return [
            'date' => $weekStart->copy()->addDays($day)->toDateString(),
            'meal' => $meal->value,
            'food_id' => $food->id,
            'name' => $food->name,
            'grams' => $grams,
            ...$food->scaled($grams),
            'est_cost' => Money::format(max(0, min(2_000_000, (int) ($row['cost'] ?? 0)))),
        ];
    }
}

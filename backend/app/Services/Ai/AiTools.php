<?php

namespace App\Services\Ai;

use App\Enums\EventStatus;
use App\Enums\EventType;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Enums\TransactionType;
use App\Models\AiActionProposal;
use App\Models\Budget;
use App\Models\Category;
use App\Models\User;
use App\Services\Finance\DebtSchedule;
use App\Services\Finance\FinanceReport;
use App\Services\Finance\MonthRange;
use App\Services\Nutrition\NutritionTargets;
use App\Services\Planning\EventOccurrences;
use App\Services\Weather\OpenMeteo;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Functions Gemini may call (spec §9.5 step 4). Every one is scoped to the signed-in user and returns small,
 * already-aggregated data — never raw tables. Reads only, except propose_* which create a pending proposal the
 * user must confirm. There is deliberately no way to create or change transactions.
 */
class AiTools
{
    /** @var list<int> proposals created during this turn, returned to the UI */
    public array $proposalIds = [];

    private string $timezone;

    public function __construct(
        private User $user,
        private ?int $conversationId,
        private EventOccurrences $events,
        private FinanceReport $report,
        private DebtSchedule $debts,
        private OpenMeteo $weather,
    ) {
        $this->timezone = $user->settings?->timezone ?? config('app.timezone');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function declarations(): array
    {
        $date = ['type' => 'string', 'description' => 'Local date YYYY-MM-DD'];
        $dateTime = ['type' => 'string', 'description' => 'Local date-time YYYY-MM-DDTHH:MM'];

        return [
            ['name' => 'get_tasks', 'description' => 'List the user\'s tasks.', 'parameters' => ['type' => 'object', 'properties' => [
                'scope' => ['type' => 'string', 'enum' => ['today', 'overdue', 'upcoming_7_days', 'open'], 'description' => 'Which tasks'],
            ], 'required' => ['scope']]],
            ['name' => 'get_schedule', 'description' => 'Events and task deadlines between two dates (max 14 days).', 'parameters' => ['type' => 'object', 'properties' => [
                'date_from' => $date, 'date_to' => $date,
            ], 'required' => ['date_from', 'date_to']]],
            ['name' => 'get_free_time', 'description' => 'Free time slots between 07:00 and 22:00 on a day (gaps between events).', 'parameters' => ['type' => 'object', 'properties' => [
                'date' => $date,
            ], 'required' => ['date']]],
            ['name' => 'get_spending', 'description' => 'Income and spending totals between two dates, spending per category. Transfers are excluded. Optionally one category by name.', 'parameters' => ['type' => 'object', 'properties' => [
                'date_from' => $date, 'date_to' => $date, 'category' => ['type' => 'string', 'description' => 'Category name, e.g. Ăn uống'],
            ], 'required' => ['date_from', 'date_to']]],
            ['name' => 'get_budgets', 'description' => 'Monthly budgets with amount spent and percent used.', 'parameters' => ['type' => 'object', 'properties' => [
                'month' => ['type' => 'string', 'description' => 'YYYY-MM'],
            ], 'required' => ['month']]],
            ['name' => 'get_debts', 'description' => 'Debt / buy-now-pay-later repayments due in the next N days (and overdue ones).', 'parameters' => ['type' => 'object', 'properties' => [
                'days' => ['type' => 'integer', 'description' => '1 to 60'],
            ], 'required' => ['days']]],
            ['name' => 'get_nutrition', 'description' => 'Daily calorie/protein targets, lasting food preferences (allergies, dishes to avoid: always respect them when suggesting food), what the user ate each day, and their confirmed meal plan (which planned dishes were eaten). Max 14 days.', 'parameters' => ['type' => 'object', 'properties' => [
                'date_from' => $date, 'date_to' => $date,
            ], 'required' => ['date_from', 'date_to']]],
            ['name' => 'get_fitness', 'description' => 'The user\'s workouts (exercises, sets, best weight) and body weight trend over the last N days.', 'parameters' => ['type' => 'object', 'properties' => [
                'days' => ['type' => 'integer', 'description' => '1 to 90'],
            ], 'required' => ['days']]],
            ['name' => 'get_weather', 'description' => 'Weather now, next hours and 3 days for the user\'s city.'], // no parameters
            ['name' => 'propose_task', 'description' => 'Suggest creating a task. The user must confirm; nothing is saved until then.', 'parameters' => ['type' => 'object', 'properties' => [
                'title' => ['type' => 'string'], 'due_at' => $dateTime, 'priority' => ['type' => 'string', 'enum' => ['low', 'medium', 'high', 'urgent']], 'description' => ['type' => 'string'],
            ], 'required' => ['title']]],
            ['name' => 'propose_event', 'description' => 'Suggest adding a calendar event. The user must confirm; nothing is saved until then.', 'parameters' => ['type' => 'object', 'properties' => [
                'title' => ['type' => 'string'], 'start_at' => $dateTime, 'end_at' => $dateTime,
                'event_type' => ['type' => 'string', 'enum' => ['study', 'work', 'workout', 'rest', 'personal']], 'location' => ['type' => 'string'],
            ], 'required' => ['title', 'start_at', 'end_at', 'event_type']]],
        ];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    public function call(string $name, array $args): array
    {
        try {
            return match ($name) {
                'get_tasks' => $this->tasks((string) ($args['scope'] ?? 'open')),
                'get_schedule' => $this->schedule($this->date($args['date_from'] ?? null), $this->date($args['date_to'] ?? null)),
                'get_free_time' => $this->freeTime($this->date($args['date'] ?? null)),
                'get_spending' => $this->spending($this->date($args['date_from'] ?? null), $this->date($args['date_to'] ?? null), $args['category'] ?? null),
                'get_budgets' => $this->budgets((string) ($args['month'] ?? now($this->timezone)->format('Y-m'))),
                'get_debts' => $this->debtsDue(max(1, min(60, (int) ($args['days'] ?? 14)))),
                'get_nutrition' => $this->nutrition($this->date($args['date_from'] ?? null), $this->date($args['date_to'] ?? null)),
                'get_fitness' => $this->fitness(max(1, min(90, (int) ($args['days'] ?? 14)))),
                'get_weather' => $this->weatherNow(),
                'propose_task' => $this->proposeTask($args),
                'propose_event' => $this->proposeEvent($args),
                default => ['error' => "Unknown function {$name}"],
            };
        } catch (Throwable $e) {
            // Bad arguments from the model: tell it, so it can retry or explain — never a 500 for the user.
            // Still logged (stderr on Render), so a real bug in a tool doesn't hide behind the model's apology.
            report($e);

            return ['error' => $e->getMessage()];
        }
    }

    private function date(mixed $value): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', (string) $value, $this->timezone)->startOfDay();
    }

    private function local(?Carbon $at): ?string
    {
        return $at?->copy()->setTimezone($this->timezone)->format('Y-m-d H:i');
    }

    /**
     * @return array<string, mixed>
     */
    private function tasks(string $scope): array
    {
        $now = now($this->timezone);
        $open = array_map(fn (TaskStatus $s) => $s->value, TaskStatus::open());
        $query = $this->user->tasks()->whereIn('status', $open);

        match ($scope) {
            'today' => $query->whereBetween('due_at', [$now->copy()->startOfDay()->utc(), $now->copy()->endOfDay()->utc()]),
            'overdue' => $query->where('due_at', '<', $now->copy()->utc()),
            'upcoming_7_days' => $query->whereBetween('due_at', [$now->copy()->utc(), $now->copy()->addDays(7)->endOfDay()->utc()]),
            default => null,
        };

        return ['tasks' => $query->orderByRaw('due_at is null')->orderBy('due_at')->limit(15)->get()->map(fn ($t) => [
            'title' => $t->title,
            'due' => $this->local($t->due_at),
            'priority' => $t->priority->value,
            'status' => $t->status->value,
        ])->all()];
    }

    /**
     * @return array<string, mixed>
     */
    private function schedule(Carbon $from, Carbon $to): array
    {
        $end = $to->copy()->endOfDay();
        if ($from->diffInDays($end) > 15) {
            return ['error' => 'Range too long: max 14 days'];
        }

        return [
            'events' => $this->events->between($this->user, $from->copy()->utc(), $end->copy()->utc())
                ->reject(fn (array $o) => $o['event']->status === EventStatus::Cancelled)
                ->map(fn (array $o) => [
                    'title' => $o['event']->title,
                    'start' => $this->local($o['start']),
                    'end' => $this->local($o['end']),
                    'type' => $o['event']->event_type->value,
                    'location' => $o['event']->location,
                ])->values()->all(),
            'task_deadlines' => $this->user->tasks()
                ->whereIn('status', array_map(fn (TaskStatus $s) => $s->value, TaskStatus::open()))
                ->whereBetween('due_at', [$from->copy()->utc(), $end->copy()->utc()])
                ->orderBy('due_at')->limit(20)->get()
                ->map(fn ($t) => ['title' => $t->title, 'due' => $this->local($t->due_at)])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function freeTime(Carbon $day): array
    {
        $cursor = $day->copy()->setTime(7, 0);
        $dayEnd = $day->copy()->setTime(22, 0);
        $busy = $this->events->between($this->user, $cursor->copy()->utc(), $dayEnd->copy()->utc())
            ->reject(fn (array $o) => $o['event']->status === EventStatus::Cancelled)
            ->map(fn (array $o) => [$o['start']->copy()->setTimezone($this->timezone), $o['end']->copy()->setTimezone($this->timezone)])
            ->sortBy(fn (array $b) => $b[0])
            ->values();

        $free = [];
        foreach ($busy as [$start, $end]) {
            if ($start->gt($cursor)) {
                $free[] = ['from' => $cursor->format('H:i'), 'to' => $start->min($dayEnd)->format('H:i')];
            }
            $cursor = $cursor->max($end);
        }
        if ($cursor->lt($dayEnd)) {
            $free[] = ['from' => $cursor->format('H:i'), 'to' => $dayEnd->format('H:i')];
        }

        return ['date' => $day->toDateString(), 'free_slots' => $free, 'busy_count' => $busy->count()];
    }

    /**
     * @return array<string, mixed>
     */
    private function spending(Carbon $from, Carbon $to, ?string $category): array
    {
        // Columns are qualified: categories also has `type`.
        $base = DB::table('transactions')
            ->where('transactions.user_id', $this->user->id)
            ->whereNull('transactions.deleted_at')
            ->where('transactions.occurred_at', '>=', $from->copy()->utc())
            ->where('transactions.occurred_at', '<', $to->copy()->addDay()->utc());

        $totals = (clone $base)
            ->selectRaw("coalesce(sum(case when transactions.type = 'income' then transactions.amount else 0 end), 0) as income")
            ->selectRaw("coalesce(sum(case when transactions.type = 'expense' then transactions.amount else 0 end), 0) as expense")
            ->first();

        // Match the category name in PHP: SQL lower() isn't Unicode-aware everywhere ("Ăn uống" vs "ăn uống").
        $categoryIds = $category === null ? null : Category::visibleTo($this->user)->get(['id', 'name'])
            ->filter(fn (Category $c) => mb_strtolower($c->name) === mb_strtolower(trim($category)))
            ->pluck('id')->all();
        if ($categoryIds === []) {
            return ['error' => "No category named \"{$category}\". Call without category to see all."];
        }

        $byCategory = (clone $base)
            ->where('transactions.type', TransactionType::Expense->value)
            ->leftJoin('categories', 'categories.id', '=', 'transactions.category_id')
            ->when($categoryIds, fn ($q) => $q->whereIn('transactions.category_id', $categoryIds))
            ->groupBy('categories.name')
            ->selectRaw("coalesce(categories.name, 'Không phân loại') as category, sum(transactions.amount) as amount, count(*) as count")
            ->orderByDesc('amount')
            ->limit(10)
            ->get()
            ->map(fn ($r) => ['category' => $r->category, 'amount_vnd' => Money::format($r->amount), 'transactions' => (int) $r->count])
            ->all();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'income_vnd' => Money::format($totals->income),
            'expense_vnd' => Money::format($totals->expense),
            'expense_by_category' => $byCategory,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function budgets(string $month): array
    {
        $range = MonthRange::for($this->user, $month);
        $byCategory = $this->report->expensesByCategory($this->user, $range)->pluck('amount', 'category_id');
        $total = $this->report->totals($this->user, $range)['expense'];
        $names = Category::visibleTo($this->user)->pluck('name', 'id');

        return ['month' => $month, 'budgets' => Budget::where('user_id', $this->user->id)->whereDate('period_start', "{$month}-01")->get()
            ->map(function (Budget $b) use ($byCategory, $total, $names) {
                $spent = $b->category_id === null ? $total : ($byCategory[$b->category_id] ?? '0.00');

                return [
                    'name' => $b->category_id === null ? 'Tổng chi tiêu' : ($names[$b->category_id] ?? 'Danh mục'),
                    'amount_vnd' => Money::format($b->amount),
                    'spent_vnd' => $spent,
                    'percent_used' => (int) bcdiv(bcmul($spent, '100', 2), Money::format($b->amount), 0),
                ];
            })->all()];
    }

    /**
     * @return array<string, mixed>
     */
    private function debtsDue(int $days): array
    {
        $now = now($this->timezone);

        return ['repayments' => $this->debts->between($this->user, $now->copy()->subMonth()->toDateString(), $now->copy()->addDays($days)->toDateString())
            ->reject(fn (array $d) => $d['paid'])
            ->map(fn (array $d) => [
                'debt' => $d['account']->name,
                'kind' => $d['account']->account_type->value === 'liability' ? 'I owe' : 'owed to me',
                'due_date' => $d['due_date'],
                'amount_vnd' => $d['amount'],
                'outstanding_vnd' => $d['outstanding'],
                'overdue' => $d['overdue'],
            ])->values()->all()];
    }

    /**
     * @return array<string, mixed>
     */
    private function nutrition(Carbon $from, Carbon $to): array
    {
        $to = $to->min($from->copy()->addDays(13));
        $profile = $this->user->nutritionProfile;
        $eaten = $this->user->foodEntries()->whereBetween('eaten_at', [$from->copy()->utc(), $to->copy()->endOfDay()->utc()])->get()
            ->groupBy(fn ($e) => $e->eaten_at->copy()->setTimezone($this->timezone)->toDateString());
        $planned = $this->user->mealPlanItems()->with('food')
            ->whereDate('date', '>=', $from->toDateString())->whereDate('date', '<=', $to->toDateString())->get()
            ->groupBy(fn ($i) => $i->date->toDateString());

        $days = [];
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $key = $day->toDateString();
            $entries = $eaten[$key] ?? collect();
            $days[] = [
                'date' => $key,
                'eaten_kcal' => (int) round($entries->sum('kcal')),
                'eaten_protein_g' => round($entries->sum('protein_g'), 1),
                'planned' => ($planned[$key] ?? collect())->map(fn ($i) => [
                    'meal' => $i->meal->value, 'dish' => $i->food->name, 'grams' => $i->grams, 'eaten' => $i->food_entry_id !== null,
                ])->values()->all(),
            ];
        }

        return [
            'targets' => $profile ? NutritionTargets::for($profile, now()->year) : 'No nutrition profile yet (the user can set one in Dinh dưỡng).',
            'food_preferences' => $profile?->food_preferences,
            'days' => $days,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fitness(int $days): array
    {
        $since = now($this->timezone)->subDays($days)->startOfDay();
        $workouts = $this->user->workouts()->with('sets.exercise')->where('performed_at', '>=', $since->copy()->utc())->latest('performed_at')->get();
        $weights = $this->user->bodyMeasurements()->whereDate('measured_on', '>=', $since->toDateString())->orderBy('measured_on')->get();

        return [
            'workouts' => $workouts->map(fn ($w) => [
                'date' => $this->local($w->performed_at),
                'duration_min' => $w->duration_min,
                // One line per exercise: sets, best weight, total minutes/km for cardio
                'exercises' => $w->sets->groupBy('exercise_id')->map(fn ($sets) => array_filter([
                    'name' => $sets->first()->exercise->name,
                    'sets' => $sets->count(),
                    'reps' => $sets->pluck('reps')->filter()->implode('/') ?: null,
                    'best_weight_kg' => $sets->max('weight_kg'),
                    'minutes' => $sets->sum('duration_min') ?: null,
                    'km' => $sets->sum('distance_km') ?: null,
                ], fn ($v) => $v !== null))->values()->all(),
            ])->all(),
            'weight_kg' => $weights->map(fn ($m) => ['date' => $m->measured_on->toDateString(), 'weight' => $m->weight_kg])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function weatherNow(): array
    {
        $s = $this->user->settings;
        if ($s?->latitude === null) {
            return ['error' => 'No city set. The user can choose one in Settings → Tùy chọn.'];
        }

        return ['city' => $s->city_name, ...($this->weather->forecast($s->latitude, $s->longitude, $this->timezone) ?? ['error' => 'Weather unavailable'])];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    private function proposeTask(array $args): array
    {
        $payload = [
            'title' => mb_substr(trim((string) ($args['title'] ?? '')), 0, 255),
            'description' => isset($args['description']) ? mb_substr((string) $args['description'], 0, 5000) : null,
            'priority' => TaskPriority::tryFrom((string) ($args['priority'] ?? ''))?->value ?? TaskPriority::Medium->value,
            'due_at' => isset($args['due_at']) ? Carbon::parse((string) $args['due_at'], $this->timezone)->utc()->toIso8601String() : null,
        ];
        if ($payload['title'] === '') {
            return ['error' => 'title is required'];
        }

        return $this->propose('create_task', $payload);
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    private function proposeEvent(array $args): array
    {
        $start = Carbon::parse((string) $args['start_at'], $this->timezone);
        $end = Carbon::parse((string) $args['end_at'], $this->timezone);
        if ($end->lte($start)) {
            return ['error' => 'end_at must be after start_at'];
        }

        return $this->propose('create_event', [
            'title' => mb_substr(trim((string) $args['title']), 0, 255),
            'start_at' => $start->utc()->toIso8601String(),
            'end_at' => $end->utc()->toIso8601String(),
            'event_type' => EventType::tryFrom((string) ($args['event_type'] ?? ''))?->value ?? EventType::Personal->value,
            'location' => isset($args['location']) ? mb_substr((string) $args['location'], 0, 255) : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function propose(string $type, array $payload): array
    {
        $proposal = new AiActionProposal([
            'conversation_id' => $this->conversationId,
            'action_type' => $type,
            'payload' => $payload,
            'status' => 'pending',
            'expires_at' => now()->addDay(),
        ]);
        $proposal->user_id = $this->user->id;
        $proposal->save();
        $this->proposalIds[] = $proposal->id;

        return ['proposal_id' => $proposal->id, 'status' => 'pending_user_confirmation'];
    }
}

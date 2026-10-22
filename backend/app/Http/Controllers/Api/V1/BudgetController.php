<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\CategoryType;
use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Services\Finance\FinanceReport;
use App\Services\Finance\MonthRange;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Monthly budgets with spending computed on read (spec §9.4: % used, warn > 80% and > 100%).
 */
class BudgetController extends Controller
{
    public function __construct(private FinanceReport $report) {}

    public function index(Request $request): JsonResponse
    {
        $month = $request->validate(['month' => ['required', 'date_format:Y-m']])['month'];
        $user = $request->user();
        $range = MonthRange::for($user, $month);

        $budgets = Budget::where('user_id', $user->id)
            ->whereDate('period_start', "{$month}-01")
            ->orderByRaw('category_id is not null') // overall budget first
            ->orderBy('id')
            ->get();

        $byCategory = $this->report->expensesByCategory($user, $range)->pluck('amount', 'category_id');
        $total = $this->report->totals($user, $range)['expense'];

        return response()->json([
            'data' => $budgets->map(fn (Budget $b) => $this->present(
                $b,
                $b->category_id === null ? $total : ($byCategory[$b->category_id] ?? '0.00'),
            )),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'month' => ['required', 'date_format:Y-m'],
            // Only spending can be budgeted: a system or own expense category, or null for the overall budget.
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')
                    ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id))
                    ->where('type', CategoryType::Expense->value),
            ],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
        ]);

        $start = Carbon::createFromFormat('Y-m-d', "{$data['month']}-01")->startOfDay();
        $exists = Budget::where('user_id', $user->id)
            ->whereDate('period_start', $start->toDateString())
            ->where(fn ($q) => isset($data['category_id']) ? $q->where('category_id', $data['category_id']) : $q->whereNull('category_id'))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages(['category_id' => 'Tháng này đã có ngân sách cho mục này.']);
        }

        $budget = new Budget([
            'category_id' => $data['category_id'] ?? null,
            'period_start' => $start->toDateString(),
            'period_end' => $start->copy()->endOfMonth()->toDateString(),
            'amount' => $data['amount'],
        ]);
        $budget->user_id = $user->id;
        $budget->save();

        return response()->json(['data' => $this->present($budget, $this->spentFor($request, $budget))], 201);
    }

    public function update(Request $request, Budget $budget): JsonResponse
    {
        Gate::authorize('update', $budget);

        $budget->update($request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
        ]));

        return response()->json(['data' => $this->present($budget, $this->spentFor($request, $budget))]);
    }

    public function destroy(Budget $budget): Response
    {
        Gate::authorize('delete', $budget);

        $budget->delete();

        return response()->noContent();
    }

    private function spentFor(Request $request, Budget $budget): string
    {
        $range = MonthRange::for($request->user(), $budget->period_start->format('Y-m'));

        return $budget->category_id === null
            ? $this->report->totals($request->user(), $range)['expense']
            : ($this->report->expensesByCategory($request->user(), $range)->firstWhere('category_id', $budget->category_id)?->amount ?? '0.00');
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Budget $budget, string $spent): array
    {
        $amount = Money::format($budget->amount);

        return [
            'id' => $budget->id,
            'category_id' => $budget->category_id,
            'period_start' => $budget->period_start->toDateString(),
            'period_end' => $budget->period_end->toDateString(),
            'amount' => $amount,
            'spent' => $spent,
            'remaining' => bcsub($amount, $spent, 2),
            // Whole percent, exact (bcmath): 80 → warning, 100+ → over budget
            'percent' => (int) bcdiv(bcmul($spent, '100', 2), $amount, 0),
        ];
    }
}

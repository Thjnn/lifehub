<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EventStatus;
use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\EventOccurrenceResource;
use App\Http\Resources\TaskResource;
use App\Models\Budget;
use App\Services\Finance\DebtSchedule;
use App\Services\Finance\FinanceReport;
use App\Services\Finance\MonthRange;
use App\Services\Planning\EventOccurrences;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * GET /dashboard (spec §9.1): everything the home screen needs in one round trip — one wait on a cold Render
 * instead of six. "Today" and "this month" are in the user's timezone; every figure states its period.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, EventOccurrences $events, FinanceReport $report, DebtSchedule $debts): JsonResponse
    {
        $user = $request->user();
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $now = Carbon::now($timezone);
        $dayStart = $now->copy()->startOfDay();
        $dayEnd = $now->copy()->endOfDay();
        $open = array_map(fn (TaskStatus $s) => $s->value, TaskStatus::open());

        $dueToday = $user->tasks()
            ->whereBetween('due_at', [$dayStart->copy()->utc(), $dayEnd->copy()->utc()])
            ->where('status', '!=', TaskStatus::Cancelled->value);

        $overdue = $user->tasks()->whereIn('status', $open)->where('due_at', '<', $now->copy()->utc());
        $upcoming = $user->tasks()->whereIn('status', $open)
            ->where('due_at', '>=', $now->copy()->utc())
            ->where('due_at', '<=', $now->copy()->addDays(3)->endOfDay()->utc());

        $month = $now->format('Y-m');
        $range = MonthRange::for($user, $month);
        $totals = $report->totals($user, $range);
        $overallBudget = Budget::where('user_id', $user->id)->whereNull('category_id')->whereDate('period_start', "{$month}-01")->first();

        return response()->json([
            'data' => [
                'today' => $now->toDateString(),
                'tasks' => [
                    'due_today_total' => (clone $dueToday)->count(),
                    'due_today_done' => (clone $dueToday)->where('status', TaskStatus::Completed->value)->count(),
                    'overdue_count' => (clone $overdue)->count(),
                    'overdue' => TaskResource::collection($overdue->orderBy('due_at')->limit(5)->get()),
                    'upcoming' => TaskResource::collection($upcoming->orderBy('due_at')->limit(5)->get()),
                ],
                'events_today' => EventOccurrenceResource::collection(
                    $events->between($user, $dayStart->copy()->utc(), $dayEnd->copy()->utc())
                        ->reject(fn (array $o) => $o['event']->status === EventStatus::Cancelled)
                        ->values(),
                ),
                'finance' => [
                    'month' => $month,
                    'income' => $totals['income'],
                    'expense' => $totals['expense'],
                    'budget' => $overallBudget === null ? null : [
                        'amount' => Money::format($overallBudget->amount),
                        'remaining' => bcsub(Money::format($overallBudget->amount), $totals['expense'], 2),
                    ],
                ],
                // Unpaid repayments: overdue (last month) and the coming week
                'debts_due' => $debts->between($user, $now->copy()->subMonth()->toDateString(), $now->copy()->addDays(7)->toDateString())
                    ->reject(fn (array $d) => $d['paid'])
                    ->map(fn (array $d) => [
                        'account_id' => $d['account']->id,
                        'account_name' => $d['account']->name,
                        'account_type' => $d['account']->account_type,
                        'due_date' => $d['due_date'],
                        'amount' => $d['amount'],
                        'overdue' => $d['overdue'],
                    ])
                    ->values(),
            ],
        ]);
    }
}

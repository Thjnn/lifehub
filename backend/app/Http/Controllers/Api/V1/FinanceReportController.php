<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceReport;
use App\Services\Finance\MonthRange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /reports/finance?month=YYYY-MM — totals, spending by category, and the previous month to compare (spec §9.4).
 */
class FinanceReportController extends Controller
{
    public function __invoke(Request $request, FinanceReport $report): JsonResponse
    {
        $month = $request->validate(['month' => ['required', 'date_format:Y-m']])['month'];
        $user = $request->user();
        $range = MonthRange::for($user, $month);

        $totals = $report->totals($user, $range);

        return response()->json([
            'data' => [
                'month' => $month,
                'income' => $totals['income'],
                'expense' => $totals['expense'],
                'net' => bcsub($totals['income'], $totals['expense'], 2),
                'previous' => $report->totals($user, $range->previous($user)),
                'by_category' => $report->expensesByCategory($user, $range),
            ],
        ]);
    }
}

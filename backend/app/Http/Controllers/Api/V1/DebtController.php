<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Finance\DebtSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * GET /debts/due?from=YYYY-MM-DD&to=YYYY-MM-DD — repayment due items in a local-date range.
 */
class DebtController extends Controller
{
    public function due(Request $request, DebtSchedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        if (Carbon::parse($data['from'])->diffInDays(Carbon::parse($data['to'])) > 400) {
            throw ValidationException::withMessages(['to' => 'Khoảng thời gian tối đa khoảng 1 năm.']);
        }

        return response()->json([
            'data' => $schedule->between($request->user(), $data['from'], $data['to'])->map(fn (array $item) => [
                'account_id' => $item['account']->id,
                'account_name' => $item['account']->name,
                'account_type' => $item['account']->account_type,
                'due_date' => $item['due_date'],
                'amount' => $item['amount'],
                'outstanding' => $item['outstanding'],
                'paid' => $item['paid'],
                'overdue' => $item['overdue'],
            ]),
        ]);
    }
}

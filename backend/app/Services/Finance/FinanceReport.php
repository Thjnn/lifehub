<?php

namespace App\Services\Finance;

use App\Enums\TransactionType;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Monthly aggregates, all computed in SQL. Transfers are never income or spending (spec §9.4).
 */
class FinanceReport
{
    /**
     * @return array{income: string, expense: string}
     */
    public function totals(User $user, MonthRange $range): array
    {
        $row = $this->inRange($user, $range)
            ->selectRaw("coalesce(sum(case when type = 'income' then amount else 0 end), 0) as income")
            ->selectRaw("coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as expense")
            ->first();

        return ['income' => Money::format($row->income), 'expense' => Money::format($row->expense)];
    }

    /**
     * Spending per category (null = uncategorised), largest first.
     *
     * @return Collection<int, object{category_id: int|null, amount: string}>
     */
    public function expensesByCategory(User $user, MonthRange $range): Collection
    {
        return $this->inRange($user, $range)
            ->where('type', TransactionType::Expense->value)
            ->groupBy('category_id')
            ->selectRaw('category_id, sum(amount) as amount')
            ->orderByDesc('amount')
            ->get()
            ->map(fn ($row) => (object) ['category_id' => $row->category_id, 'amount' => Money::format($row->amount)]);
    }

    private function inRange(User $user, MonthRange $range)
    {
        return DB::table('transactions')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->where('occurred_at', '>=', $range->start)
            ->where('occurred_at', '<', $range->end);
    }
}

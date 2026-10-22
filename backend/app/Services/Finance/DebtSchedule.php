<?php

namespace App\Services\Finance;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Turns debt accounts' schedules into concrete due items for a date range (calendar, finance overview,
 * Phase 11 reminders). Dates are local calendar dates in the user's timezone.
 *
 * - Liability (I owe): repaid by transfers INTO the account.
 * - Receivable (owed to me): repaid by transfers OUT of it.
 * Nothing is due once the debt is cleared. A monthly instalment counts as paid when repayments since the
 * previous due date cover it.
 */
class DebtSchedule
{
    /**
     * @return Collection<int, array{account: Account, due_date: string, amount: string, outstanding: string, paid: bool, overdue: bool}>
     */
    public function between(User $user, string $from, string $to): Collection
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $start = CarbonImmutable::parse($from, $timezone)->startOfDay();
        $end = CarbonImmutable::parse($to, $timezone)->startOfDay();
        $today = CarbonImmutable::now($timezone)->startOfDay();

        $accounts = $user->accounts()
            ->withBalance()
            ->where('is_active', true)
            ->whereIn('account_type', [AccountType::Liability->value, AccountType::Receivable->value])
            ->where(fn ($q) => $q->whereNotNull('due_date')->orWhereNotNull('due_day'))
            ->get();

        $items = collect();
        foreach ($accounts as $account) {
            $outstanding = $account->account_type === AccountType::Liability
                ? bcmul(Money::format($account->balance), '-1', 2)
                : Money::format($account->balance);
            if (bccomp($outstanding, '0', 2) <= 0) {
                continue; // cleared
            }

            foreach ($this->dueDates($account, $start, $end, $timezone) as $due) {
                $amount = $account->installment_amount !== null && bccomp(Money::format($account->installment_amount), $outstanding, 2) < 0
                    ? Money::format($account->installment_amount)
                    : $outstanding;
                $paid = $account->due_day !== null
                    && bccomp($this->repaidBetween($account, $this->monthlyDue($account->due_day, $due->startOfMonth()->subMonth()), $due), $amount, 2) >= 0;

                $items->push([
                    'account' => $account,
                    'due_date' => $due->toDateString(),
                    'amount' => $amount,
                    'outstanding' => $outstanding,
                    'paid' => $paid,
                    'overdue' => ! $paid && $due->lt($today),
                ]);
            }
        }

        return $items->sortBy('due_date')->values();
    }

    /**
     * @return list<CarbonImmutable>
     */
    private function dueDates(Account $account, CarbonImmutable $start, CarbonImmutable $end, string $timezone): array
    {
        if ($account->due_date !== null) {
            $date = CarbonImmutable::parse($account->due_date->toDateString(), $timezone);

            return $date->betweenIncluded($start, $end) ? [$date] : [];
        }

        // Monthly: day N of each month, clamped (day 31 → 28/29 Feb, 30 Apr ...). Never before the account existed.
        $created = CarbonImmutable::parse($account->created_at)->setTimezone($timezone)->startOfDay();
        $dates = [];
        for ($month = $start->startOfMonth(); $month->lte($end); $month = $month->addMonthNoOverflow()) {
            $date = $this->monthlyDue($account->due_day, $month);
            if ($date->betweenIncluded($start, $end) && $date->gte($created)) {
                $dates[] = $date;
            }
        }

        return $dates;
    }

    // Day N of the month containing $month, clamped to the month's length (31 → 30 Apr, 28/29 Feb).
    private function monthlyDue(int $day, CarbonImmutable $month): CarbonImmutable
    {
        $first = $month->startOfMonth();

        return $first->setDay(min($day, $first->daysInMonth));
    }

    /**
     * Repayments in the local-date window (after, until]: transfers into a liability / out of a receivable.
     */
    private function repaidBetween(Account $account, CarbonImmutable $after, CarbonImmutable $until): string
    {
        $column = $account->account_type === AccountType::Liability ? 'to_account_id' : 'account_id';

        $sum = DB::table('transactions')
            ->where($column, $account->id)
            ->where('type', 'transfer')
            ->whereNull('deleted_at')
            ->where('occurred_at', '>=', $after->addDay()->utc())
            ->where('occurred_at', '<', $until->addDay()->utc())
            ->sum('amount');

        return Money::format($sum);
    }
}

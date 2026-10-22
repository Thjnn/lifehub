<?php

namespace App\Services\Finance;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * A "YYYY-MM" month in the user's timezone, as a UTC [start, end) range for queries.
 * 00:30 on 1 Nov in Vietnam belongs to November even though it is 31 Oct in UTC.
 */
final class MonthRange
{
    public function __construct(public readonly Carbon $start, public readonly Carbon $end) {}

    public static function for(User $user, string $month): self
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $start = Carbon::createFromFormat('Y-m-d H:i:s', "{$month}-01 00:00:00", $timezone);

        return new self($start->copy()->utc(), $start->copy()->addMonth()->utc());
    }

    public function previous(User $user): self
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');

        return self::for($user, $this->start->copy()->setTimezone($timezone)->subMonth()->format('Y-m'));
    }
}

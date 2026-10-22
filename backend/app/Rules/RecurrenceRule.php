<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use RRule\RfcParser;
use RRule\RRule;

/**
 * Accepts the subset of RRULE the app needs ("recurring cơ bản", spec §9.2) and rejects rules that would
 * expand into huge numbers of occurrences (HOURLY, MINUTELY, ...).
 */
class RecurrenceRule implements ValidationRule
{
    private const ALLOWED_FREQ = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

    private const ALLOWED_PARTS = ['FREQ', 'INTERVAL', 'UNTIL', 'COUNT', 'BYDAY', 'BYMONTHDAY'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $message = 'Quy tắc lặp lại không hợp lệ.';

        try {
            $parts = array_change_key_case(RfcParser::parseRRule($value), CASE_UPPER);
            new RRule($value, now()); // full validation by the library
        } catch (\Throwable) {
            $fail($message);

            return;
        }

        if (! in_array($parts['FREQ'] ?? null, self::ALLOWED_FREQ, true) || array_diff(array_keys($parts), self::ALLOWED_PARTS)) {
            $fail($message);
        }
    }
}

<?php

namespace App\Support;

/**
 * Money leaves the API as a decimal string ("150000.00"), never a float, so no 0.1 + 0.2 rounding.
 * Postgres returns NUMERIC as a string already; SQLite (tests) may return a number.
 */
class Money
{
    public static function format(string|int|float|null $value): string
    {
        return bcadd((string) ($value ?? 0), '0', 2);
    }
}

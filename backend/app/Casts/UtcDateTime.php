<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * The built-in datetime cast stores the wall-clock time and drops the offset, so "14:00+07:00" would be
 * saved as 14:00 UTC. This one converts to UTC first (spec §10: store UTC, display in the user's timezone).
 *
 * @implements CastsAttributes<Carbon, mixed>
 */
class UtcDateTime implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Carbon
    {
        return $value === null ? null : Carbon::parse($value, 'UTC');
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : Carbon::parse($value)->utc()->format('Y-m-d H:i:s');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** System exercises (user_id null, inserted by the migration, read-only) plus the user's own. */
#[Fillable(['name', 'kind', 'muscle_group'])]
class Exercise extends Model
{
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }
}

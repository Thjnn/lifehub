<?php

namespace App\Models;

use App\Casts\UtcDateTime;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['performed_at', 'duration_min', 'note', 'event_id'])]
class Workout extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['performed_at' => UtcDateTime::class];
    }

    public function sets(): HasMany
    {
        return $this->hasMany(WorkoutSet::class)->orderBy('position');
    }
}

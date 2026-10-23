<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'exercise_id', 'position', 'reps', 'weight_kg', 'duration_min', 'distance_km'])]
class WorkoutSet extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['weight_kg' => 'float', 'duration_min' => 'float', 'distance_km' => 'float'];
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }
}

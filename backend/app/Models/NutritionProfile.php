<?php

namespace App\Models;

use App\Enums\NutritionGoal;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['goal', 'sex', 'birth_year', 'weight_kg', 'height_cm', 'workouts_per_week', 'food_preferences'])]
class NutritionProfile extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['goal' => NutritionGoal::class, 'weight_kg' => 'float'];
    }
}

<?php

namespace App\Models;

use App\Enums\Meal;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['date', 'meal', 'food_id', 'grams', 'est_cost', 'food_entry_id'])]
class MealPlanItem extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'meal' => Meal::class,
            'est_cost' => 'decimal:2',
        ];
    }

    public function food(): BelongsTo
    {
        return $this->belongsTo(Food::class);
    }
}

<?php

namespace App\Models;

use App\Casts\UtcDateTime;
use App\Enums\Meal;
use Database\Factories\FoodEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['eaten_at', 'meal', 'food_id', 'name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'source'])]
class FoodEntry extends Model
{
    /** @use HasFactory<FoodEntryFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'eaten_at' => UtcDateTime::class,
            'meal' => Meal::class,
            'grams' => 'float',
            'kcal' => 'float',
            'protein_g' => 'float',
            'carbs_g' => 'float',
            'fat_g' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

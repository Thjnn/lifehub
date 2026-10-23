<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Read-only reference dishes, inserted by the nutrition migration. */
class Food extends Model
{
    protected $table = 'foods';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['kcal' => 'float', 'protein_g' => 'float', 'carbs_g' => 'float', 'fat_g' => 'float'];
    }

    /**
     * Nutrition for an amount in grams (values are per serving).
     *
     * @return array{kcal: float, protein_g: float, carbs_g: float, fat_g: float}
     */
    public function scaled(float $grams): array
    {
        $factor = $grams / $this->serving_grams;

        return array_map(fn ($v) => round($v * $factor, 1), $this->only(['kcal', 'protein_g', 'carbs_g', 'fat_g']));
    }
}

<?php

namespace Database\Factories;

use App\Enums\Meal;
use App\Models\FoodEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FoodEntry>
 */
class FoodEntryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'eaten_at' => now(),
            'meal' => Meal::Lunch,
            'name' => 'Cơm gà',
            'grams' => 400,
            'kcal' => 600,
            'protein_g' => 30,
            'carbs_g' => 75,
            'fat_g' => 18,
            'source' => 'manual',
        ];
    }
}

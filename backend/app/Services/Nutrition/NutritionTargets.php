<?php

namespace App\Services\Nutrition;

use App\Enums\NutritionGoal;
use App\Models\NutritionProfile;

/**
 * Daily calorie/protein targets by formula, never by AI (spec §15.4):
 * Mifflin-St Jeor BMR × activity factor, then adjusted for the goal.
 */
class NutritionTargets
{
    /**
     * @return array{bmr: int, tdee: int, kcal: int, protein_g: int}
     */
    public static function for(NutritionProfile $p, int $year): array
    {
        $age = $year - $p->birth_year;
        $bmr = 10 * $p->weight_kg + 6.25 * $p->height_cm - 5 * $age + ($p->sex === 'male' ? 5 : -161);

        $activity = match (true) {
            $p->workouts_per_week === 0 => 1.2,
            $p->workouts_per_week <= 2 => 1.375,
            $p->workouts_per_week <= 5 => 1.55,
            default => 1.725,
        };
        $tdee = $bmr * $activity;

        [$kcalFactor, $proteinPerKg] = match ($p->goal) {
            NutritionGoal::Cut => [0.85, 2.0], // ~15% deficit, more protein to keep muscle
            NutritionGoal::Maintain => [1.0, 1.6],
            NutritionGoal::Bulk => [1.1, 1.8], // ~10% surplus
        };

        return [
            'bmr' => (int) round($bmr),
            'tdee' => (int) round($tdee),
            'kcal' => (int) (round($tdee * $kcalFactor / 10) * 10),
            'protein_g' => (int) round($p->weight_kg * $proteinPerKg),
        ];
    }
}

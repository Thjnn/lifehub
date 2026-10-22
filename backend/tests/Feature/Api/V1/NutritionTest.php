<?php

namespace Tests\Feature\Api\V1;

use App\Models\Food;
use App\Models\FoodEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NutritionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-10-22 05:00:00'); // 12:00 in Vietnam
        $this->user = User::factory()->create();
    }

    public function test_targets_follow_mifflin_st_jeor_and_the_goal(): void
    {
        // Male, 25 y, 70 kg, 175 cm: BMR = 700 + 1093.75 − 125 + 5 = 1673.75; 4 workouts/week → ×1.55 = 2594
        $this->actingAs($this->user)->getJson('/api/v1/nutrition/profile')->assertOk()->assertJsonPath('data', null);

        $profile = ['sex' => 'male', 'birth_year' => 2001, 'weight_kg' => 70, 'height_cm' => 175, 'workouts_per_week' => 4];
        $this->actingAs($this->user)->putJson('/api/v1/nutrition/profile', $profile + ['goal' => 'maintain'])
            ->assertOk()
            ->assertJsonPath('data.targets', ['bmr' => 1674, 'tdee' => 2594, 'kcal' => 2590, 'protein_g' => 112]);
        $this->actingAs($this->user)->putJson('/api/v1/nutrition/profile', $profile + ['goal' => 'cut'])
            ->assertJsonPath('data.targets.kcal', 2210) // 2594.3 × 0.85 = 2205.2 → nearest 10
            ->assertJsonPath('data.targets.protein_g', 140);

        $this->assertDatabaseCount('nutrition_profiles', 1);
    }

    public function test_dish_from_the_table_is_scaled_by_grams_on_the_server(): void
    {
        $pho = Food::where('name', 'Phở bò')->sole(); // 500 g = 450 kcal

        $this->actingAs($this->user)->postJson('/api/v1/food-entries', [
            'eaten_at' => '2026-10-22T07:30:00+07:00', 'meal' => 'breakfast', 'food_id' => $pho->id, 'grams' => 250,
            'kcal' => 1, // ignored: numbers for a table dish come from the table
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Phở bò')
            ->assertJsonPath('data.kcal', 225)
            ->assertJsonPath('data.source', 'table');
    }

    public function test_manual_entry_needs_its_numbers(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/food-entries', ['eaten_at' => now()->toIso8601String(), 'meal' => 'snack'])
            ->assertJsonValidationErrors(['name', 'kcal', 'protein_g', 'carbs_g', 'fat_g']);
    }

    public function test_day_list_uses_the_users_timezone_with_totals(): void
    {
        FoodEntry::factory()->for($this->user)->create(['eaten_at' => '2026-10-21 17:30:00', 'kcal' => 300, 'protein_g' => 10]); // 00:30 on the 22nd in VN
        FoodEntry::factory()->for($this->user)->create(['eaten_at' => '2026-10-22 05:00:00', 'kcal' => 600, 'protein_g' => 30.5]);
        FoodEntry::factory()->for($this->user)->create(['eaten_at' => '2026-10-21 16:30:00']); // 23:30 on the 21st
        FoodEntry::factory()->create(['eaten_at' => '2026-10-22 05:00:00']); // someone else

        $this->actingAs($this->user)->getJson('/api/v1/food-entries?date=2026-10-22')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.totals.kcal', 900)
            ->assertJsonPath('meta.totals.protein_g', 40.5)
            ->assertJsonPath('meta.targets', null);
    }

    public function test_users_cannot_touch_each_others_entries(): void
    {
        $other = FoodEntry::factory()->create();
        $this->actingAs($this->user)->deleteJson("/api/v1/food-entries/{$other->id}")->assertForbidden();
        $this->assertModelExists($other);
    }
}

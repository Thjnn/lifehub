<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Category;
use App\Models\Food;
use App\Models\FoodEntry;
use App\Models\MealPlanItem;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class MealPlanTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $pho;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test', 'services.gemini.fallback_model' => null]);
        $this->travelTo('2026-10-22 03:00:00'); // Thursday 10:00 in Vietnam; the week starts Monday 2026-10-19
        $this->user = User::factory()->create();
        $this->actingAs($this->user)->putJson('/api/v1/nutrition/profile', [
            'goal' => 'maintain', 'sex' => 'male', 'birth_year' => 2001, 'weight_kg' => 70, 'height_cm' => 175, 'workouts_per_week' => 4,
        ])->assertOk();
        $this->pho = Food::where('name', 'Phở bò')->value('id'); // 500 g = 450 kcal, 25 g protein
    }

    /**
     * One reply per generate call, in order (Http::fake can only be set once per test: later fakes never win).
     *
     * @param  list<array<string, mixed>>  ...$replies  each a list of meal items
     */
    private function fakeGemini(array ...$replies): void
    {
        $sequence = Http::sequence();
        foreach ($replies as $items) {
            $sequence->push(['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => json_encode(['items' => $items])]]]]]]);
        }
        Http::fake(['generativelanguage.googleapis.com/*' => $sequence]);
    }

    private function confirm(TestResponse $proposal): TestResponse
    {
        return $this->actingAs($this->user)->postJson('/api/v1/ai/proposals/'.$proposal->json('data.id').'/confirm')->assertOk();
    }

    private function generate(?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->user)->postJson('/api/v1/ai/meal-plan', ['week_start' => '2026-10-22']);
    }

    // Phở for breakfast today, as if confirmed (the confirm path itself is covered by the first test).
    private function planItem(): MealPlanItem
    {
        return $this->user->mealPlanItems()->create(['date' => '2026-10-22', 'meal' => 'breakfast', 'food_id' => $this->pho, 'grams' => 500, 'est_cost' => '45000']);
    }

    public function test_only_valid_dishes_from_the_table_and_nothing_saved_until_confirmed(): void
    {
        $this->fakeGemini([
            ['day' => 0, 'meal' => 'breakfast', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000],
            ['day' => 1, 'meal' => 'lunch', 'food_id' => 99999, 'grams' => 300, 'cost' => 30000], // not in the table
            ['day' => 9, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 1], // outside the week
            ['day' => 2, 'meal' => 'brunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 1], // unknown meal
            ['day' => 2, 'meal' => 'dinner', 'food_id' => $this->pho, 'grams' => 5, 'cost' => 1], // absurd amount
        ]);

        $proposal = $this->generate()->assertOk()
            ->assertJsonPath('data.action_type', 'create_meal_plan')
            ->assertJsonPath('data.payload.week_start', '2026-10-19') // normalized to Monday
            ->assertJsonCount(1, 'data.payload.items')
            ->assertJsonPath('data.payload.items.0.kcal', 450) // from the table, not the model
            ->assertJsonPath('data.payload.total_cost_vnd', '45000.00')
            ->json('data');
        $this->assertDatabaseCount('meal_plan_items', 0);
        Http::assertSent(fn (HttpRequest $r) => data_get($r->data(), 'generationConfig.responseMimeType') === 'application/json'
            && str_contains(data_get($r->data(), 'contents.0.parts.0.text'), 'khoảng 2590 kcal'));

        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal['id']}/confirm")->assertOk()->assertJsonPath('data.created.count', 1);
        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal['id']}/confirm")->assertConflict(); // only once
        $this->actingAs($this->user)->getJson('/api/v1/meal-plan?week=2026-10-25')
            ->assertOk()
            ->assertJsonPath('meta.week_start', '2026-10-19')
            ->assertJsonPath('meta.budget_vnd', null)
            ->assertJsonPath('data.0.date', '2026-10-19')
            ->assertJsonPath('data.0.name', 'Phở bò')
            ->assertJsonPath('data.0.food_entry_id', null);
    }

    public function test_needs_a_profile_and_is_limited_per_day(): void
    {
        $lunch = [['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]];
        $this->fakeGemini(...array_fill(0, 10, $lunch));

        $this->generate(User::factory()->create())->assertStatus(422);
        foreach (range(1, 10) as $i) {
            $this->generate()->assertOk();
        }
        $this->generate()->assertStatus(429);
    }

    public function test_budget_is_what_is_left_of_the_food_budget_spread_over_the_month(): void
    {
        $food = Category::whereNull('user_id')->where('name', 'Ăn uống')->value('id');
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'category_id' => $food, 'amount' => '3000000'])->assertCreated();
        Transaction::factory()->create(['account_id' => Account::factory()->for($this->user), 'category_id' => $food, 'amount' => '600000.00']);
        $this->fakeGemini([['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]]);

        // 2,400,000 left over 10 days (22nd–31st) → 1,680,000 for 7 days
        $this->generate()->assertOk()->assertJsonPath('data.payload.budget_vnd', '1680000.00');
        Http::assertSent(fn (HttpRequest $r) => str_contains(data_get($r->data(), 'contents.0.parts.0.text'), 'không vượt quá 1680000.00 VND'));
    }

    public function test_the_prompt_carries_saved_preferences_and_habits_from_the_log(): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/nutrition/profile', [
            'goal' => 'maintain', 'sex' => 'male', 'birth_year' => 2001, 'weight_kg' => 70, 'height_cm' => 175, 'workouts_per_week' => 4,
            'food_preferences' => 'Dị ứng tôm. Không ăn nội tạng.',
        ])->assertOk()->assertJsonPath('data.food_preferences', 'Dị ứng tôm. Không ăn nội tạng.');
        // 3 logged days; one entry from 40 days ago is outside the 28-day window.
        foreach (['2026-10-20 05:00', '2026-10-21 05:00', '2026-10-21 12:00', '2026-10-22 01:00', '2026-09-12 05:00'] as $at) {
            FoodEntry::factory()->for($this->user)->create(['eaten_at' => $at, 'name' => str_starts_with($at, '2026-10-21 12') ? 'Bún chả' : 'Cơm gà']);
        }
        $this->fakeGemini([['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]]);

        $this->generate()->assertOk();

        Http::assertSent(function (HttpRequest $r) {
            $prompt = data_get($r->data(), 'contents.0.parts.0.text');

            return str_contains($prompt, 'Dị ứng tôm. Không ăn nội tạng.')
                && str_contains($prompt, '3 ngày có ghi trong 28 ngày qua; trung bình 800 kcal, 40 g protein')
                && str_contains($prompt, 'Món ăn nhiều nhất: Cơm gà ×3, Bún chả ×1.');
        });
    }

    public function test_too_little_log_means_no_habits_in_the_prompt(): void
    {
        FoodEntry::factory()->for($this->user)->create(['eaten_at' => '2026-10-21 05:00']);
        $this->fakeGemini([['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]]);

        $this->generate()->assertOk();

        Http::assertSent(fn (HttpRequest $r) => ! str_contains(data_get($r->data(), 'contents.0.parts.0.text'), 'Thói quen'));
    }

    public function test_chatting_revises_the_proposal_and_remembers_every_request(): void
    {
        $rice = Food::where('name', 'Cơm trắng')->value('id');
        $this->fakeGemini(
            [['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]],
            [['day' => 0, 'meal' => 'lunch', 'food_id' => $rice, 'grams' => 200, 'cost' => 10000]],
            [['day' => 1, 'meal' => 'lunch', 'food_id' => $rice, 'grams' => 200, 'cost' => 10000]],
        );
        $first = $this->generate()->assertOk()->json('data');

        $revise = fn (int $id, string $feedback) => $this->actingAs($this->user)
            ->postJson('/api/v1/ai/meal-plan', ['week_start' => '2026-11-30', 'proposal_id' => $id, 'feedback' => $feedback]);
        $second = $revise($first['id'], 'bớt phở')->assertOk()
            ->assertJsonPath('data.payload.week_start', '2026-10-19') // the proposal's week, not the one sent
            ->assertJsonPath('data.payload.items.0.food_id', $rice)
            ->assertJsonPath('data.payload.history.1', ['role' => 'user', 'text' => 'bớt phở'])
            ->json('data');
        $revise($second['id'], 'sáng ăn nhẹ')->assertOk()->assertJsonCount(5, 'data.payload.history');

        Http::assertSent(fn (HttpRequest $r) => str_contains($text = data_get($r->data(), 'contents.0.parts.0.text'), "0|lunch|{$rice}|Cơm trắng|200")
            && str_contains($text, "- bớt phở\n- sáng ăn nhẹ"));
        // Only the newest proposal can be confirmed or revised.
        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$first['id']}/confirm")->assertConflict();
        $revise($first['id'], 'nữa')->assertConflict();
    }

    public function test_cannot_revise_someone_elses_proposal_or_without_a_message(): void
    {
        $this->fakeGemini([['day' => 0, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]]);
        $id = $this->generate()->assertOk()->json('data.id');

        $this->actingAs(User::factory()->create())->postJson('/api/v1/ai/meal-plan', ['week_start' => '2026-10-19', 'proposal_id' => $id, 'feedback' => 'x'])->assertNotFound();
        $this->actingAs($this->user)->postJson('/api/v1/ai/meal-plan', ['week_start' => '2026-10-19', 'proposal_id' => $id])->assertUnprocessable();
    }

    public function test_eaten_logs_the_table_numbers_once_and_deleting_the_entry_undoes_it(): void
    {
        $item = $this->planItem();

        $this->actingAs($this->user)->getJson('/api/v1/food-entries?date=2026-10-22')->assertJsonPath('meta.plan.0.id', $item->id);
        $entryId = $this->actingAs($this->user)->postJson("/api/v1/meal-plan-items/{$item->id}/eat")->assertCreated()->json('data.food_entry_id');
        $this->assertDatabaseHas('food_entries', ['id' => $entryId, 'name' => 'Phở bò', 'kcal' => 450, 'meal' => 'breakfast', 'eaten_at' => '2026-10-22 00:30:00']); // 07:30 VN
        $this->actingAs($this->user)->postJson("/api/v1/meal-plan-items/{$item->id}/eat")->assertConflict();

        $this->actingAs($this->user)->deleteJson("/api/v1/food-entries/{$entryId}")->assertNoContent();
        $this->assertNull($item->fresh()->food_entry_id);
    }

    public function test_a_new_plan_replaces_only_dishes_not_eaten_yet(): void
    {
        $eaten = $this->planItem();
        $this->actingAs($this->user)->postJson("/api/v1/meal-plan-items/{$eaten->id}/eat")->assertCreated();

        $this->fakeGemini(
            [
                ['day' => 4, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 250, 'cost' => 25000],
                ['day' => 5, 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 250, 'cost' => 25000],
            ],
            [['day' => 6, 'meal' => 'dinner', 'food_id' => $this->pho, 'grams' => 500, 'cost' => 45000]],
        );
        $this->confirm($this->generate());
        $this->confirm($this->generate());

        $this->assertModelExists($eaten);
        $this->assertSame(['2026-10-22', '2026-10-25'], MealPlanItem::orderBy('date')->get()->map(fn ($i) => $i->date->toDateString())->all());
    }

    public function test_the_plan_is_the_users_to_change_add_to_and_trim(): void
    {
        $item = $this->planItem(); // Phở 500 g, ~45,000
        $rice = Food::where('name', 'Cơm tấm sườn')->value('id');

        // Same dish, half the amount: the price estimate follows
        $this->actingAs($this->user)->putJson("/api/v1/meal-plan-items/{$item->id}", ['date' => '2026-10-23', 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 250])
            ->assertOk()->assertJsonPath('data.date', '2026-10-23')->assertJsonPath('data.kcal', 225)->assertJsonPath('data.est_cost', '22500.00');
        // Another dish: no estimate
        $this->actingAs($this->user)->putJson("/api/v1/meal-plan-items/{$item->id}", ['date' => '2026-10-23', 'meal' => 'lunch', 'food_id' => $rice, 'grams' => 400])
            ->assertOk()->assertJsonPath('data.name', 'Cơm tấm sườn')->assertJsonPath('data.est_cost', null);
        // A dish of their own, from the table only
        $this->actingAs($this->user)->postJson('/api/v1/meal-plan-items', ['date' => '2026-10-24', 'meal' => 'snack', 'food_id' => $rice, 'grams' => 200])->assertCreated();
        $this->actingAs($this->user)->postJson('/api/v1/meal-plan-items', ['date' => '2026-10-24', 'meal' => 'snack', 'food_id' => 99999, 'grams' => 2])
            ->assertJsonValidationErrors(['food_id', 'grams']);

        // Once eaten, it's fixed (the log is the record)
        $this->actingAs($this->user)->postJson("/api/v1/meal-plan-items/{$item->id}/eat")->assertCreated();
        $this->actingAs($this->user)->putJson("/api/v1/meal-plan-items/{$item->id}", ['date' => '2026-10-23', 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 100])->assertConflict();
        $this->assertDatabaseCount('meal_plan_items', 2);
    }

    public function test_users_cannot_see_or_touch_each_others_plan(): void
    {
        $item = $this->planItem();
        $other = User::factory()->create();

        $this->actingAs($other)->getJson('/api/v1/meal-plan?week=2026-10-19')->assertJsonCount(0, 'data');
        $this->actingAs($other)->postJson("/api/v1/meal-plan-items/{$item->id}/eat")->assertForbidden();
        $this->actingAs($other)->putJson("/api/v1/meal-plan-items/{$item->id}", ['date' => '2026-10-22', 'meal' => 'lunch', 'food_id' => $this->pho, 'grams' => 100])->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/v1/meal-plan-items/{$item->id}")->assertForbidden();
        $this->assertModelExists($item);
    }

    public function test_coach_reads_targets_meals_and_plan(): void
    {
        $this->user->nutritionProfile->update(['food_preferences' => 'Dị ứng tôm']);
        $item = $this->planItem();
        $this->actingAs($this->user)->postJson("/api/v1/meal-plan-items/{$item->id}/eat")->assertCreated();
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['candidates' => [['content' => ['role' => 'model', 'parts' => [['functionCall' => ['name' => 'get_nutrition', 'args' => ['date_from' => '2026-10-22', 'date_to' => '2026-10-23']]]]]]]])
            ->push(['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => 'Hôm nay bạn đã ăn 450 kcal.']]]]]]),
        ]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Hôm nay mình ăn đủ chưa?'])->assertOk();

        Http::assertSent(function (HttpRequest $r) {
            $response = data_get($r->data(), 'contents.2.parts.0.functionResponse.response');

            return $response !== null
                && $response['targets']['kcal'] === 2590
                && $response['food_preferences'] === 'Dị ứng tôm'
                && $response['days'][0] === ['date' => '2026-10-22', 'eaten_kcal' => 450, 'eaten_protein_g' => 25.0, 'planned' => [
                    ['meal' => 'breakfast', 'dish' => 'Phở bò', 'grams' => 500, 'eaten' => true],
                ]]
                && $response['days'][1]['planned'] === [];
        });
    }
}

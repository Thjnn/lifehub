<?php

namespace Tests\Feature\Api\V1;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class FoodScanTest extends TestCase
{
    use RefreshDatabase;

    // A real 1×1 PNG
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test', 'services.gemini.fallback_model' => null]);
        $this->user = User::factory()->create();
    }

    /** @param  list<array<string, mixed>>  $items */
    private function fakeGemini(array $items, string $dishName = 'Bữa trưa'): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['role' => 'model', 'parts' => [
            ['text' => json_encode(['dish_name' => $dishName, 'items' => $items])],
        ]]]]])]);
    }

    private function scan(string $dataUrl = 'data:image/png;base64,'.self::PNG): TestResponse
    {
        return $this->actingAs($this->user)->postJson('/api/v1/ai/food-scan', ['image' => $dataUrl]);
    }

    public function test_table_dishes_get_table_numbers_others_keep_the_flagged_estimate_and_nothing_is_saved(): void
    {
        $pho = Food::where('name', 'Phở bò')->value('id'); // 500 g = 450 kcal
        $this->fakeGemini([
            ['name' => 'Phở', 'food_id' => $pho, 'grams' => 250, 'kcal' => 9999, 'protein_g' => 1, 'carbs_g' => 1, 'fat_g' => 1, 'confidence' => 0.9],
            ['name' => 'Bánh flan', 'food_id' => 0, 'grams' => 100, 'kcal' => 150, 'protein_g' => 4, 'carbs_g' => 22, 'fat_g' => 5, 'confidence' => 1.7],
            ['name' => '', 'food_id' => 0, 'grams' => 100, 'kcal' => 1, 'protein_g' => 1, 'carbs_g' => 1, 'fat_g' => 1, 'confidence' => 0.5], // no name
            ['name' => 'Núi cơm', 'food_id' => $pho, 'grams' => 90000, 'kcal' => 1, 'protein_g' => 1, 'carbs_g' => 1, 'fat_g' => 1, 'confidence' => 0.5], // absurd amount
        ], 'Phở và bánh flan');

        $this->scan()->assertOk()
            ->assertJsonPath('data.name', 'Phở và bánh flan')
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.name', 'Phở bò')
            ->assertJsonPath('data.items.0.kcal', 225) // the table's numbers, not the model's 9999
            ->assertJsonPath('data.items.0.estimated', false)
            ->assertJsonPath('data.items.1.food_id', null)
            ->assertJsonPath('data.items.1.kcal', 150)
            ->assertJsonPath('data.items.1.estimated', true)
            ->assertJsonPath('data.items.1.confidence', 1); // clamped

        Http::assertSent(fn (HttpRequest $r) => data_get($r->data(), 'contents.0.parts.0.inlineData.mimeType') === 'image/png'
            && data_get($r->data(), 'contents.0.parts.0.inlineData.data') === self::PNG);
        $this->assertDatabaseCount('food_entries', 0);
    }

    public function test_only_real_images_reach_gemini(): void
    {
        Http::fake();

        $this->scan('data:image/png;base64,'.base64_encode('not an image'))->assertStatus(422);
        $this->scan('data:image/png;base64,'.base64_encode('GIF89a'.str_repeat("\0", 20)))->assertStatus(422); // a GIF dressed as PNG
        $this->scan('data:text/html;base64,'.self::PNG)->assertJsonValidationErrors('image');
        Http::assertNothingSent();
    }

    public function test_daily_scan_limit(): void
    {
        $this->fakeGemini([]);

        foreach (range(1, 10) as $i) {
            $this->scan()->assertOk()->assertJsonPath('data.items', []);
        }
        $this->scan()->assertStatus(429);
    }

    public function test_a_scanned_plate_is_logged_as_one_dish_with_its_components(): void
    {
        $cucumber = Food::where('name', 'Dưa leo')->value('id'); // 100 g = 15 kcal
        $plate = ['eaten_at' => now()->toIso8601String(), 'meal' => 'lunch', 'name' => 'Salad ức gà', 'components' => [
            ['name' => 'Dưa leo', 'food_id' => $cucumber, 'grams' => 200, 'kcal' => 999, 'protein_g' => 99, 'carbs_g' => 0, 'fat_g' => 0], // table: client numbers ignored
            ['name' => 'Sốt mè lạ', 'food_id' => null, 'grams' => 20, 'kcal' => 90, 'protein_g' => 1, 'carbs_g' => 4, 'fat_g' => 8],
        ]];

        $this->actingAs($this->user)->postJson('/api/v1/food-entries', $plate)->assertCreated()
            ->assertJsonPath('data.name', 'Salad ức gà')
            ->assertJsonPath('data.source', 'scan')
            ->assertJsonPath('data.grams', 220)
            ->assertJsonPath('data.kcal', 120) // 30 (table) + 90 (estimate)
            ->assertJsonPath('data.components.0.kcal', 30)
            ->assertJsonPath('data.components.0.estimated', false)
            ->assertJsonPath('data.components.1.estimated', true);
        $this->assertDatabaseCount('food_entries', 1);

        $this->actingAs($this->user)->postJson('/api/v1/food-entries', ['name' => null] + $plate)->assertJsonValidationErrors('name');
        $this->actingAs($this->user)->postJson('/api/v1/food-entries', ['components' => [['name' => 'x', 'grams' => 0]]] + $plate)
            ->assertJsonValidationErrors(['components.0.grams', 'components.0.kcal']);
    }
}

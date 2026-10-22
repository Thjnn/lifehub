<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Event;
use App\Models\Task;
use App\Models\User;
use App\Services\Weather\OpenMeteo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-10-22 03:00:00'); // 10:00 in Vietnam
        $this->user = User::factory()->create();
    }

    public function test_dashboard_summarises_today_in_the_users_timezone(): void
    {
        $tz = 'Asia/Ho_Chi_Minh';
        Task::factory()->for($this->user)->create(['due_at' => now($tz)->setTime(17, 0), 'status' => 'completed']);
        Task::factory()->for($this->user)->create(['due_at' => now($tz)->setTime(23, 30)]); // still today in Vietnam
        Task::factory()->for($this->user)->create(['due_at' => now($tz)->subDay()]); // overdue
        Task::factory()->for($this->user)->create(['due_at' => now($tz)->addDays(2)]); // upcoming
        Task::factory()->create(['due_at' => now()]); // someone else's

        Event::factory()->for($this->user)->create(['start_at' => now($tz)->setTime(14, 0), 'end_at' => now($tz)->setTime(15, 0), 'location' => 'Thư viện']);
        Event::factory()->for($this->user)->create(['start_at' => now($tz)->addDay()->setTime(9, 0), 'end_at' => now($tz)->addDay()->setTime(10, 0)]);

        $cash = Account::factory()->for($this->user)->create();
        $this->actingAs($this->user)->putJson('/api/v1/transactions/'.Str::uuid(), [
            'type' => 'expense', 'account_id' => $cash->id, 'amount' => '45000', 'occurred_at' => now()->toIso8601String(), 'description' => null,
        ]);
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'amount' => '3000000']);

        $this->actingAs($this->user)->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.today', '2026-10-22')
            ->assertJsonPath('data.tasks.due_today_total', 2)
            ->assertJsonPath('data.tasks.due_today_done', 1)
            ->assertJsonPath('data.tasks.overdue_count', 1)
            ->assertJsonCount(2, 'data.tasks.upcoming') // open and due within 3 days: today 23:30 and day +2
            ->assertJsonCount(1, 'data.events_today')
            ->assertJsonPath('data.events_today.0.location', 'Thư viện')
            ->assertJsonPath('data.finance.expense', '45000.00')
            ->assertJsonPath('data.finance.budget.remaining', '2955000.00');
    }

    public function test_settings_update_and_validation(): void
    {
        $this->actingAs($this->user)->patchJson('/api/v1/me/settings', [
            'timezone' => 'Asia/Bangkok',
            'city' => ['name' => 'Đà Nẵng', 'latitude' => 16.0678, 'longitude' => 108.2208],
        ])->assertOk()
            ->assertJsonPath('data.settings.timezone', 'Asia/Bangkok')
            ->assertJsonPath('data.settings.city.name', 'Đà Nẵng');

        $this->actingAs($this->user)->patchJson('/api/v1/me/settings', ['timezone' => 'Mars/Olympus'])->assertJsonValidationErrors('timezone');
        $this->actingAs($this->user)->patchJson('/api/v1/me/settings', ['city' => ['name' => 'X']])->assertJsonValidationErrors(['city.latitude', 'city.longitude']);

        $this->actingAs($this->user)->patchJson('/api/v1/me/settings', ['city' => null])->assertJsonPath('data.settings.city', null);
    }

    // Weather for the dashboard is fetched in the browser; the server-side client only feeds the AI Coach.
    public function test_server_forecast_for_the_ai_is_cached_for_an_hour(): void
    {
        Http::fake(['api.open-meteo.com/*' => Http::response($this->forecastFixture())]);
        $weather = app(OpenMeteo::class);

        $forecast = $weather->forecast(21.0285, 105.8542, 'Asia/Ho_Chi_Minh');
        $weather->forecast(21.0285, 105.8542, 'Asia/Ho_Chi_Minh');

        $this->assertSame(27.4, $forecast['current']['temperature']);
        $this->assertSame('2026-10-22T10:00', $forecast['hourly'][0]['time']); // starts at the current local hour
        $this->assertCount(3, $forecast['daily']);
        Http::assertSentCount(1); // second call served from cache
    }

    public function test_server_forecast_failure_is_null_and_not_cached(): void
    {
        // The real production failure: Render's shared IP hit Open-Meteo's daily per-IP quota
        Http::fake(['api.open-meteo.com/*' => Http::sequence()
            ->push(['error' => true, 'reason' => 'Daily API request limit exceeded. Please try again tomorrow.'], 429)
            ->push(['unexpected' => true]) // malformed 200
            ->push($this->forecastFixture())]);
        $weather = app(OpenMeteo::class);

        $this->assertNull($weather->forecast(21.0285, 105.8542, 'Asia/Ho_Chi_Minh'));
        $this->assertNull($weather->forecast(21.0285, 105.8542, 'Asia/Ho_Chi_Minh'));
        $this->assertNotNull($weather->forecast(21.0285, 105.8542, 'Asia/Ho_Chi_Minh')); // failures weren't cached
    }

    /**
     * @return array<string, mixed>
     */
    private function forecastFixture(): array
    {
        $hours = array_map(fn (int $h) => sprintf('2026-10-22T%02d:00', $h), range(0, 23));

        return [
            'current' => ['temperature_2m' => 27.4, 'apparent_temperature' => 30.1, 'weather_code' => 2, 'precipitation' => 0],
            'hourly' => [
                'time' => $hours,
                'temperature_2m' => array_fill(0, 24, 26.0),
                'precipitation_probability' => array_fill(0, 24, 10),
                'weather_code' => array_fill(0, 24, 3),
            ],
            'daily' => [
                'time' => ['2026-10-22', '2026-10-23', '2026-10-24'],
                'weather_code' => [3, 61, 80],
                'temperature_2m_max' => [31, 29, 28],
                'temperature_2m_min' => [24, 24, 23],
                'precipitation_probability_max' => [20, 80, 60],
            ],
        ];
    }
}

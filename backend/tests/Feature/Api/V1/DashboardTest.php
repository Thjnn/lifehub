<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Event;
use App\Models\Task;
use App\Models\User;
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

    public function test_weather_is_fetched_once_per_hour_and_needs_a_city(): void
    {
        $this->actingAs($this->user)->getJson('/api/v1/weather')->assertJsonPath('data', null);

        Http::fake(['api.open-meteo.com/*' => Http::response($this->forecastFixture())]);
        $this->user->settings->update(['city_name' => 'Hà Nội', 'latitude' => 21.0285, 'longitude' => 105.8542]);

        $this->actingAs($this->user)->getJson('/api/v1/weather')
            ->assertOk()
            ->assertJsonPath('data.city', 'Hà Nội')
            ->assertJsonPath('data.current.temperature', 27.4)
            ->assertJsonPath('data.hourly.0.time', '2026-10-22T10:00') // starts at the current local hour
            ->assertJsonCount(3, 'data.daily');
        $this->actingAs($this->user)->getJson('/api/v1/weather')->assertOk();

        Http::assertSentCount(1); // second request served from cache
    }

    public function test_weather_provider_down_says_so_and_is_not_cached(): void
    {
        Http::fake(['api.open-meteo.com/*' => Http::response('oops', 500)]);
        $this->user->settings->update(['city_name' => 'Hà Nội', 'latitude' => 21.0285, 'longitude' => 105.8542]);

        $this->actingAs($this->user)->getJson('/api/v1/weather')
            ->assertStatus(503)
            ->assertJsonPath('message', 'Không tải được thời tiết cho Hà Nội lúc này, thử lại sau.');

        // A malformed answer (200 but not the expected shape) is handled the same way, not a 500
        Http::fake(['api.open-meteo.com/*' => Http::response(['unexpected' => true])]);
        $this->actingAs($this->user)->getJson('/api/v1/weather')->assertStatus(503);
    }

    public function test_city_search_proxies_the_geocoder(): void
    {
        Http::fake(['geocoding-api.open-meteo.com/*' => Http::response(['results' => [
            ['name' => 'Thành phố Hồ Chí Minh', 'admin1' => 'Hồ Chí Minh', 'country' => 'Việt Nam', 'latitude' => 10.82, 'longitude' => 106.63],
        ]])]);

        $this->actingAs($this->user)->getJson('/api/v1/weather/cities?q=Ho%20Chi%20Minh')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Thành phố Hồ Chí Minh')
            ->assertJsonPath('data.0.latitude', 10.82);
        $this->actingAs($this->user)->getJson('/api/v1/weather/cities?q=a')->assertJsonValidationErrors('q');
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

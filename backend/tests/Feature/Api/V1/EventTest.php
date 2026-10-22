<?php

namespace Tests\Feature\Api\V1;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(); // settings timezone defaults to Asia/Ho_Chi_Minh
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Học nhóm',
            'start_at' => '2026-11-02T06:00:00+07:00', // Monday 06:00 in Vietnam = Sunday 23:00 UTC
            'end_at' => '2026-11-02T07:30:00+07:00',
            'event_type' => 'study',
        ], $overrides);
    }

    private function list(string $from, string $to, array $extra = [])
    {
        return $this->actingAs($this->user)->getJson('/api/v1/events?'.http_build_query(['from' => $from, 'to' => $to] + $extra));
    }

    public function test_create_and_list_a_one_off_event(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.start_at', '2026-11-01T23:00:00+00:00');

        $this->list('2026-11-02T00:00:00+07:00', '2026-11-03T00:00:00+07:00')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Học nhóm');

        $this->list('2026-11-03T00:00:00+07:00', '2026-11-04T00:00:00+07:00')->assertJsonCount(0, 'data');
    }

    public function test_weekly_series_expands_on_the_local_weekday(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload([
            'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261112T000000Z',
        ]))->assertCreated();

        $starts = $this->list('2026-11-01T00:00:00+07:00', '2026-12-31T00:00:00+07:00')
            ->assertOk()
            ->json('data.*.start_at');

        // Mon 2, Wed 4, Mon 9, Wed 11 November at 06:00 Vietnam time. Expanding BYDAY in UTC would give
        // Mon/Wed 23:00 UTC = Tue/Thu 06:00 in Vietnam.
        $this->assertSame([
            '2026-11-01T23:00:00+00:00',
            '2026-11-03T23:00:00+00:00',
            '2026-11-08T23:00:00+00:00',
            '2026-11-10T23:00:00+00:00',
        ], $starts);
    }

    public function test_series_that_started_before_the_range_still_appears(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload(['recurrence_rule' => 'FREQ=DAILY']));

        $this->list('2027-03-10T00:00:00+07:00', '2027-03-11T00:00:00+07:00')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.start_at', '2027-03-09T23:00:00+00:00')
            ->assertJsonPath('data.0.series_start_at', '2026-11-01T23:00:00+00:00');
    }

    public function test_type_filter(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload());
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload(['event_type' => 'workout']));

        $this->list('2026-11-01T00:00:00+07:00', '2026-11-30T00:00:00+07:00', ['type' => 'workout'])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_type', 'workout');
    }

    public function test_overlaps_are_reported_but_not_blocked(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload(['title' => 'Gym']));

        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload([
            'start_at' => '2026-11-02T07:00:00+07:00',
            'end_at' => '2026-11-02T08:00:00+07:00',
        ]))
            ->assertCreated()
            ->assertJsonCount(1, 'meta.overlaps')
            ->assertJsonPath('meta.overlaps.0.title', 'Gym');

        // Back-to-back (starts exactly when 07:00–08:00 ends) is not an overlap
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload([
            'start_at' => '2026-11-02T08:00:00+07:00',
            'end_at' => '2026-11-02T09:00:00+07:00',
        ]))->assertJsonCount(0, 'meta.overlaps');
    }

    public function test_end_must_be_after_start_including_partial_patch(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload(['end_at' => '2026-11-02T05:00:00+07:00']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('end_at');

        $event = Event::factory()->for($this->user)->create();

        // Only start_at sent, moved after the stored end_at
        $this->actingAs($this->user)->patchJson("/api/v1/events/{$event->id}", [
            'start_at' => $event->end_at->copy()->addHour()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('end_at');

        $this->actingAs($this->user)->patchJson("/api/v1/events/{$event->id}", ['title' => 'Đổi tên'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Đổi tên');
    }

    public function test_recurrence_rule_validation(): void
    {
        foreach (['FREQ=HOURLY', 'FREQ=WEEKLY;BYSECOND=5', 'DTSTART:20260101T000000Z', 'nonsense'] as $rule) {
            $this->actingAs($this->user)->postJson('/api/v1/events', $this->payload(['recurrence_rule' => $rule]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('recurrence_rule');
        }
    }

    public function test_range_is_required_and_limited(): void
    {
        $this->actingAs($this->user)->getJson('/api/v1/events')->assertJsonValidationErrors(['from', 'to']);
        $this->list('2026-01-01T00:00:00Z', '2027-06-01T00:00:00Z')->assertJsonValidationErrors('to');
    }

    public function test_cannot_see_or_change_another_users_events(): void
    {
        $other = Event::factory()->create();

        $this->list(now()->toIso8601String(), now()->addWeek()->toIso8601String())->assertJsonCount(0, 'data');
        $this->actingAs($this->user)->patchJson("/api/v1/events/{$other->id}", ['title' => 'x'])->assertForbidden();
        $this->actingAs($this->user)->deleteJson("/api/v1/events/{$other->id}")->assertForbidden();
        $this->assertModelExists($other);
    }

    public function test_delete(): void
    {
        $event = Event::factory()->for($this->user)->create();

        $this->actingAs($this->user)->deleteJson("/api/v1/events/{$event->id}")->assertNoContent();
        $this->assertModelMissing($event);
    }
}

<?php

namespace Tests\Feature\Api\V1;

use App\Models\Event;
use App\Models\Exercise;
use App\Models\User;
use App\Models\Workout;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class FitnessTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $squat;

    private int $run;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-10-22 03:00:00'); // 10:00 in Vietnam
        $this->user = User::factory()->create();
        $this->squat = Exercise::where('name', 'Squat (gánh tạ)')->value('id');
        $this->run = Exercise::where('name', 'Chạy bộ')->value('id');
    }

    /** @param  array<string, mixed>  $overrides */
    private function logWorkout(array $overrides = [], ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->user)->postJson('/api/v1/workouts', $overrides + [
            'performed_at' => '2026-10-22T07:00:00+07:00',
            'duration_min' => 60,
            'sets' => [
                ['exercise_id' => $this->squat, 'reps' => 10, 'weight_kg' => 40],
                ['exercise_id' => $this->squat, 'reps' => 8, 'weight_kg' => 45],
                ['exercise_id' => $this->run, 'duration_min' => 20, 'distance_km' => 3.5],
            ],
        ]);
    }

    public function test_workout_with_sets_in_order_then_edited_and_deleted(): void
    {
        $id = $this->logWorkout()->assertCreated()
            ->assertJsonCount(3, 'data.sets')
            ->assertJsonPath('data.sets.1.weight_kg', 45)
            ->assertJsonPath('data.sets.2.exercise_name', 'Chạy bộ')
            ->json('data.id');

        $this->actingAs($this->user)->putJson("/api/v1/workouts/{$id}", [
            'performed_at' => '2026-10-22T07:00:00+07:00', 'sets' => [['exercise_id' => $this->squat, 'reps' => 12, 'weight_kg' => 40]],
        ])->assertOk()->assertJsonCount(1, 'data.sets')->assertJsonPath('data.duration_min', null);
        $this->assertDatabaseCount('workout_sets', 1);

        $this->actingAs($this->user)->getJson('/api/v1/workouts')->assertJsonPath('data.0.sets.0.reps', 12);
        $this->actingAs($this->user)->deleteJson("/api/v1/workouts/{$id}")->assertNoContent();
        $this->assertDatabaseCount('workout_sets', 0);
    }

    public function test_sets_need_effort_and_only_the_users_exercises_and_events(): void
    {
        $foreignExercise = User::factory()->create()->exercises()->create(['name' => 'Bí mật', 'kind' => 'strength']);
        $foreignEvent = Event::factory()->create();

        $this->logWorkout(['event_id' => $foreignEvent->id, 'sets' => [
            ['exercise_id' => $this->squat, 'weight_kg' => 40], // no reps nor minutes
            ['exercise_id' => $foreignExercise->id, 'reps' => 5],
        ]])->assertJsonValidationErrors(['event_id', 'sets.0.reps', 'sets.1.exercise_id']);
        $this->logWorkout(['sets' => []])->assertJsonValidationErrors('sets');
    }

    public function test_users_cannot_see_or_touch_each_others_workouts(): void
    {
        $id = $this->logWorkout()->json('data.id');
        $other = User::factory()->create();

        $this->actingAs($other)->getJson('/api/v1/workouts')->assertJsonCount(0, 'data');
        $this->actingAs($other)->putJson("/api/v1/workouts/{$id}", ['performed_at' => now()->toIso8601String(), 'sets' => [['exercise_id' => $this->squat, 'reps' => 1]]])->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/v1/workouts/{$id}")->assertForbidden();
        $this->assertModelExists(Workout::find($id));
    }

    public function test_own_exercises_are_private_and_kept_while_in_use(): void
    {
        $mine = $this->actingAs($this->user)->postJson('/api/v1/exercises', ['name' => 'Kéo dây kháng lực', 'kind' => 'strength'])
            ->assertCreated()->assertJsonPath('data.is_custom', true)->json('data.id');
        $theirs = User::factory()->create()->exercises()->create(['name' => 'Của người khác', 'kind' => 'cardio']);

        $names = collect($this->actingAs($this->user)->getJson('/api/v1/exercises')->json('data'))->pluck('name');
        $this->assertContains('Kéo dây kháng lực', $names);
        $this->assertContains('Squat (gánh tạ)', $names);
        $this->assertNotContains('Của người khác', $names);

        $this->actingAs($this->user)->deleteJson("/api/v1/exercises/{$this->squat}")->assertForbidden(); // system
        $this->actingAs($this->user)->deleteJson("/api/v1/exercises/{$theirs->id}")->assertForbidden();
        $this->logWorkout(['sets' => [['exercise_id' => $mine, 'reps' => 15]]])->assertCreated();
        $this->actingAs($this->user)->deleteJson("/api/v1/exercises/{$mine}")->assertConflict();
    }

    public function test_one_weigh_in_per_day_and_the_newest_updates_the_nutrition_profile(): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/nutrition/profile', [
            'goal' => 'cut', 'sex' => 'male', 'birth_year' => 2001, 'weight_kg' => 70, 'height_cm' => 175, 'workouts_per_week' => 4,
        ])->assertOk();

        $this->actingAs($this->user)->putJson('/api/v1/body-measurements/2026-10-22', ['weight_kg' => 69.5])->assertCreated();
        $this->actingAs($this->user)->putJson('/api/v1/body-measurements/2026-10-22', ['weight_kg' => 69.2, 'waist_cm' => 80])->assertOk();
        $this->assertDatabaseCount('body_measurements', 1);
        $this->actingAs($this->user)->getJson('/api/v1/nutrition/profile')->assertJsonPath('data.weight_kg', 69.2);

        // An older weigh-in, added later, doesn't overwrite the current weight
        $this->actingAs($this->user)->putJson('/api/v1/body-measurements/2026-10-01', ['weight_kg' => 71])->assertCreated();
        $this->actingAs($this->user)->getJson('/api/v1/nutrition/profile')->assertJsonPath('data.weight_kg', 69.2);
        $this->actingAs($this->user)->getJson('/api/v1/body-measurements')->assertJsonPath('data.0.measured_on', '2026-10-22')->assertJsonPath('data.1.weight_kg', 71);

        $id = $this->user->bodyMeasurements()->value('id');
        $this->actingAs(User::factory()->create())->deleteJson("/api/v1/body-measurements/{$id}")->assertForbidden();
        $this->actingAs($this->user)->putJson('/api/v1/body-measurements/2026-10-22', ['weight_kg' => 5])->assertJsonValidationErrors('weight_kg');
    }

    public function test_coach_reads_workouts_and_weight(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test', 'services.gemini.fallback_model' => null]);
        $this->logWorkout()->assertCreated();
        $this->actingAs($this->user)->putJson('/api/v1/body-measurements/2026-10-22', ['weight_kg' => 69.5])->assertCreated();
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['candidates' => [['content' => ['role' => 'model', 'parts' => [['functionCall' => ['name' => 'get_fitness', 'args' => ['days' => 7]]]]]]]])
            ->push(['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => 'Tốt lắm!']]]]]]),
        ]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Tuần này mình tập sao?'])->assertOk();

        Http::assertSent(function (HttpRequest $r) {
            $response = data_get($r->data(), 'contents.2.parts.0.functionResponse.response');

            return $response !== null
                && $response['workouts'][0]['exercises'][0] === ['name' => 'Squat (gánh tạ)', 'sets' => 2, 'reps' => '10/8', 'best_weight_kg' => 45.0]
                && $response['workouts'][0]['exercises'][1]['km'] === 3.5
                && $response['weight_kg'] === [['date' => '2026-10-22', 'weight' => 69.5]];
        });
    }
}

<?php

namespace Tests\Feature\Api\V1;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Ôn thi cuối kỳ',
            'description' => null,
            'priority' => 'high',
            'status' => 'todo',
            'due_at' => '2026-10-25T14:00:00+07:00',
        ], $overrides);
    }

    public function test_put_creates_a_task_with_the_client_uuid(): void
    {
        $id = (string) Str::uuid();

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$id}", $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.id', $id)
            // Stored and returned in UTC: 14:00 +07:00 = 07:00Z
            ->assertJsonPath('data.due_at', '2026-10-25T07:00:00+00:00');
    }

    public function test_put_is_idempotent(): void
    {
        $id = (string) Str::uuid();

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$id}", $this->payload())->assertCreated();
        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$id}", $this->payload(['title' => 'Đổi tên']))
            ->assertOk()
            ->assertJsonPath('data.title', 'Đổi tên');

        $this->assertDatabaseCount('tasks', 1);
    }

    public function test_status_drives_completed_at(): void
    {
        $id = (string) Str::uuid();

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$id}", $this->payload(['status' => 'completed']))
            ->assertJsonPath('data.status', 'completed');
        $this->assertNotNull(Task::find($id)->completed_at);

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$id}", $this->payload(['status' => 'todo']))
            ->assertJsonPath('data.completed_at', null);
    }

    public function test_complete_endpoint(): void
    {
        $task = Task::factory()->for($this->user)->create();

        $this->actingAs($this->user)->postJson("/api/v1/tasks/{$task->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->assertNotNull($task->fresh()->completed_at);
    }

    public function test_validation(): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/tasks/'.Str::uuid(), $this->payload([
            'title' => '',
            'priority' => 'whenever',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['title', 'priority']);
    }

    public function test_malformed_uuid_is_404(): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/tasks/not-a-uuid', $this->payload())->assertNotFound();
    }

    public function test_cannot_touch_another_users_task(): void
    {
        $other = Task::factory()->create();

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$other->id}", $this->payload())->assertForbidden();
        $this->actingAs($this->user)->postJson("/api/v1/tasks/{$other->id}/complete")->assertForbidden();
        $this->actingAs($this->user)->deleteJson("/api/v1/tasks/{$other->id}")->assertForbidden();

        $this->assertSame(TaskStatus::Todo, $other->fresh()->status);
        $this->assertNotSame('Ôn thi cuối kỳ', $other->fresh()->title);
    }

    public function test_index_only_lists_own_tasks(): void
    {
        Task::factory()->for($this->user)->count(2)->create();
        Task::factory()->count(3)->create();

        $this->actingAs($this->user)->getJson('/api/v1/tasks')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);
    }

    public function test_delete_soft_deletes_and_put_after_delete_conflicts(): void
    {
        $task = Task::factory()->for($this->user)->create();

        $this->actingAs($this->user)->deleteJson("/api/v1/tasks/{$task->id}")->assertNoContent();
        $this->assertSoftDeleted($task);

        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$task->id}", $this->payload())->assertConflict();
    }

    public function test_last_write_wins_for_offline_edits(): void
    {
        $this->travelTo('2026-10-22 10:00:00');
        $task = Task::factory()->for($this->user)->create(['title' => 'Gốc']);

        // Edited on another device at 10:05
        $this->travelTo('2026-10-22 10:05:00');
        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$task->id}", $this->payload(['title' => 'Máy B', 'client_updated_at' => now()->toIso8601String()]))->assertOk();

        // An offline edit made at 10:02 arrives later → server's newer version wins
        $this->travelTo('2026-10-22 10:10:00');
        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$task->id}", $this->payload([
            'title' => 'Máy A (offline)',
            'client_updated_at' => '2026-10-22T10:02:00Z',
        ]))->assertConflict()->assertJsonPath('data.title', 'Máy B');
        $this->assertSame('Máy B', $task->fresh()->title);

        // A newer offline edit wins; resending without client_updated_at overwrites on purpose
        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$task->id}", $this->payload(['title' => 'Máy A mới', 'client_updated_at' => '2026-10-22T10:09:00Z']))->assertOk();
        $this->actingAs($this->user)->putJson("/api/v1/tasks/{$task->id}", $this->payload(['title' => 'Ghi đè']))->assertOk();
        $this->assertSame('Ghi đè', $task->fresh()->title);
    }

    public function test_filters_and_sorting(): void
    {
        $overdue = Task::factory()->for($this->user)->create(['due_at' => now()->subDay(), 'priority' => 'low']);
        Task::factory()->for($this->user)->create(['due_at' => now()->subDay(), 'status' => 'completed']);
        $urgent = Task::factory()->for($this->user)->create(['due_at' => now()->addDays(3), 'priority' => 'urgent']);
        $noDeadline = Task::factory()->for($this->user)->create(['due_at' => null]);

        // Overdue = past deadline and still open
        $this->actingAs($this->user)->getJson('/api/v1/tasks?overdue=1')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $overdue->id);

        $this->actingAs($this->user)->getJson('/api/v1/tasks?status[]=todo&priority[]=urgent')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $urgent->id);

        // Range in +07:00 must be compared in UTC
        $from = now()->addDays(2)->setTimezone('Asia/Ho_Chi_Minh')->toIso8601String();
        $to = now()->addDays(4)->setTimezone('Asia/Ho_Chi_Minh')->toIso8601String();
        $this->actingAs($this->user)->getJson('/api/v1/tasks?'.http_build_query(['due_from' => $from, 'due_to' => $to]))
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $urgent->id);

        // Default sort: soonest deadline first, no deadline last
        $ids = $this->actingAs($this->user)->getJson('/api/v1/tasks?status[]=todo')->json('data.*.id');
        $this->assertSame([$overdue->id, $urgent->id, $noDeadline->id], $ids);

        // Priority sort: urgent first
        $this->actingAs($this->user)->getJson('/api/v1/tasks?sort=priority')
            ->assertJsonPath('data.0.id', $urgent->id);
    }
}

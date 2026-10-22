<?php

namespace Tests\Feature\Api\V1;

use App\Models\Event;
use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class NoteTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    /** @param  array<string, mixed>  $payload */
    private function upsertNote(string $id, array $payload = []): TestResponse
    {
        return $this->actingAs($this->user)->putJson("/api/v1/notes/{$id}", $payload + [
            'title' => null, 'body' => 'Nội dung', 'pinned' => false, 'task_id' => null, 'event_id' => null,
        ]);
    }

    public function test_put_creates_then_updates_with_the_same_uuid(): void
    {
        $id = (string) Str::uuid();

        $this->upsertNote($id, ['title' => 'Ý tưởng'])->assertCreated()->assertJsonPath('data.title', 'Ý tưởng');
        $this->upsertNote($id, ['title' => 'Ý tưởng hay'])->assertOk();

        $this->assertDatabaseCount('notes', 1);
        $this->assertDatabaseHas('notes', ['id' => $id, 'title' => 'Ý tưởng hay', 'user_id' => $this->user->id]);
    }

    public function test_users_cannot_see_or_touch_each_others_notes(): void
    {
        $other = Note::factory()->create();

        $this->actingAs($this->user)->getJson('/api/v1/notes')->assertOk()->assertJsonCount(0, 'data');
        $this->upsertNote($other->id)->assertForbidden();
        $this->actingAs($this->user)->deleteJson("/api/v1/notes/{$other->id}")->assertForbidden();
    }

    public function test_links_must_be_the_users_own_task_or_event(): void
    {
        $foreignTask = Task::factory()->create();
        $foreignEvent = Event::factory()->create();
        $ownTask = Task::factory()->for($this->user)->create();

        $this->upsertNote((string) Str::uuid(), ['task_id' => $foreignTask->id, 'event_id' => $foreignEvent->id])
            ->assertJsonValidationErrors(['task_id', 'event_id']);
        $this->upsertNote((string) Str::uuid(), ['task_id' => $ownTask->id])->assertCreated()->assertJsonPath('data.task_id', $ownTask->id);
    }

    public function test_pinned_first_then_recently_edited(): void
    {
        $this->travelTo(now()->subDay());
        Note::factory()->for($this->user)->create(['title' => 'Cũ', 'body' => 'mua sữa', 'pinned' => true]);
        $this->travelBack();
        Note::factory()->for($this->user)->create(['title' => 'Mới', 'body' => 'Mua bánh mì']);

        $this->actingAs($this->user)->getJson('/api/v1/notes')
            ->assertJsonPath('data.0.title', 'Cũ')
            ->assertJsonPath('data.1.title', 'Mới');
    }

    public function test_stale_offline_edit_and_edit_after_delete_conflict(): void
    {
        $note = Note::factory()->for($this->user)->create();

        $this->upsertNote($note->id, ['client_updated_at' => now()->subMinute()->toIso8601String()])->assertConflict();
        $this->upsertNote($note->id, ['body' => 'ghi đè'])->assertOk();

        $this->actingAs($this->user)->deleteJson("/api/v1/notes/{$note->id}")->assertNoContent();
        $this->upsertNote($note->id)->assertConflict();
    }
}

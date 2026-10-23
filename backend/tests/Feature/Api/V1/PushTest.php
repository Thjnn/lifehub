<?php

namespace Tests\Feature\Api\V1;

use App\Models\PushSubscription;
use App\Models\Task;
use App\Models\User;
use App\Services\Push\PushSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Testing\TestResponse;
use Minishlink\WebPush\VAPID;
use Tests\TestCase;

class PushTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    /** @var list<array{endpoint: string, payload: array<string, string>}> what the fake sender was asked to send */
    private array $sent = [];

    /** @var array<string, string> endpoint => result the fake push service answers */
    private array $answers = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.reminders.secret' => 'cron-secret']);
        $this->user = User::factory()->create(); // settings.timezone = Asia/Ho_Chi_Minh by default

        $test = $this;
        $this->app->instance(PushSender::class, new class($test) extends PushSender
        {
            public function __construct(private PushTest $test) {}

            public function configured(): bool
            {
                return true;
            }

            public function send(PushSubscription $subscription, string $payload): string
            {
                return $this->test->recordSend($subscription->endpoint, $payload);
            }
        });
    }

    public function recordSend(string $endpoint, string $payload): string
    {
        $this->sent[] = ['endpoint' => $endpoint, 'payload' => json_decode($payload, true)];

        return $this->answers[$endpoint] ?? 'sent';
    }

    private function subscribe(string $endpoint = 'https://push.example/device-1', ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->user)->postJson('/api/v1/push/subscriptions', ['endpoint' => $endpoint, 'keys' => ['p256dh' => 'BPk3y', 'auth' => 'aut0']]);
    }

    private function cron(string $secret = 'cron-secret'): TestResponse
    {
        return $this->postJson('/api/internal/reminders', [], ['X-Reminder-Secret' => $secret]);
    }

    private function task(string $title, string $dueAt, string $status = 'todo', ?User $user = null): Task
    {
        return Task::factory()->for($user ?? $this->user)->create(['title' => $title, 'due_at' => $dueAt, 'status' => $status]);
    }

    public function test_the_cron_endpoint_needs_the_secret(): void
    {
        $this->cron('wrong')->assertUnauthorized();
        $this->postJson('/api/internal/reminders')->assertUnauthorized();
        config(['services.reminders.secret' => null]);
        $this->cron('')->assertUnauthorized(); // an unset secret never matches an empty header
    }

    public function test_one_combined_reminder_for_open_tasks_due_in_the_next_three_days(): void
    {
        $this->travelTo('2026-10-24 01:30:00'); // 08:30 in Vietnam: morning slot
        $this->subscribe()->assertCreated();
        $this->subscribe('https://push.example/laptop')->assertCreated();
        $this->task('Ôn thi Toán', '2026-10-24 13:00:00'); // today 20:00 VN
        $this->task('Nộp báo cáo', '2026-10-25 02:00:00', 'in_progress'); // tomorrow 09:00 VN
        $this->task('Đã xong', '2026-10-24 13:00:00', 'completed');
        $this->task('Đã huỷ', '2026-10-24 13:00:00', 'cancelled');
        $this->task('Quá xa', '2026-10-28 02:00:00');
        $this->task('Của người khác', '2026-10-24 13:00:00', 'todo', User::factory()->create());

        $this->cron()->assertOk()->assertJsonPath('data', ['users' => 1, 'sent' => 2, 'expired' => 0]);

        $this->assertCount(2, $this->sent); // one message, to each of the user's two devices
        $this->assertSame([
            'title' => 'Bạn có 2 việc sắp đến hạn',
            'body' => 'Ôn thi Toán (hôm nay 20:00), Nộp báo cáo (mai 09:00)',
            'url' => '/app/tasks?view=upcoming',
            'tag' => 'deadlines',
        ], $this->sent[0]['payload']);
    }

    public function test_each_slot_is_sent_once_late_runs_catch_up_and_nights_stay_quiet(): void
    {
        $this->subscribe()->assertCreated();
        $this->task('Ôn thi', '2026-10-25 13:00:00');

        $this->travelTo('2026-10-24 00:30:00'); // 07:30 VN: before the morning slot
        $this->cron()->assertJsonPath('data.users', 0);
        $this->travelTo('2026-10-24 03:40:00'); // 10:40 VN: the 08:00 run was skipped, this one catches up
        $this->cron()->assertJsonPath('data.users', 1);
        $this->travelTo('2026-10-24 04:10:00'); // 11:10 VN: same slot, already sent
        $this->cron()->assertJsonPath('data.users', 0);
        $this->travelTo('2026-10-24 13:05:00'); // 20:05 VN: evening slot
        $this->cron()->assertJsonPath('data.users', 1);
        $this->travelTo('2026-10-24 18:00:00'); // 01:00 VN: night
        $this->cron()->assertJsonPath('data.users', 0);

        $this->assertCount(2, $this->sent);
    }

    public function test_nothing_due_means_no_notification_and_dead_devices_are_forgotten(): void
    {
        $this->travelTo('2026-10-24 01:30:00');
        $this->subscribe('https://push.example/gone')->assertCreated();
        $this->cron()->assertJsonPath('data.users', 0);
        $this->assertSame([], $this->sent);

        $this->user->settings->forceFill(['last_reminder_slot' => null])->save();
        $this->task('Ôn thi', '2026-10-24 13:00:00');
        $this->answers['https://push.example/gone'] = 'expired'; // 410 from the push service
        $this->cron()->assertJsonPath('data.expired', 1);
        $this->assertDatabaseCount('push_subscriptions', 0);
    }

    public function test_subscriptions_belong_to_the_signed_in_user_and_the_device(): void
    {
        $this->subscribe()->assertCreated();
        $this->subscribe()->assertOk(); // same device again: updated, not duplicated
        $this->actingAs($this->user)->postJson('/api/v1/push/subscriptions', ['endpoint' => 'http://insecure.example', 'keys' => []])
            ->assertJsonValidationErrors(['endpoint', 'keys.p256dh', 'keys.auth']);

        // Another user can't remove this device's subscription…
        $other = User::factory()->create();
        $this->actingAs($other)->deleteJson('/api/v1/push/subscriptions', ['endpoint' => 'https://push.example/device-1'])->assertNoContent();
        $this->assertDatabaseHas('push_subscriptions', ['user_id' => $this->user->id]);
        // …but signing in with another account on the same browser moves the device to it.
        $this->subscribe('https://push.example/device-1', $other)->assertOk();
        $this->assertDatabaseHas('push_subscriptions', ['user_id' => $other->id]);
        $this->assertDatabaseCount('push_subscriptions', 1);

        $this->actingAs($other)->deleteJson('/api/v1/push/subscriptions', ['endpoint' => 'https://push.example/device-1'])->assertNoContent();
        $this->assertDatabaseCount('push_subscriptions', 0);
    }

    public function test_vapid_command_prints_keys_the_push_library_accepts(): void
    {
        Artisan::call('push:vapid');
        preg_match_all('/^(VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)=(.+)$/m', Artisan::output(), $m);
        $keys = array_combine($m[1], $m[2]);

        $validated = VAPID::validate(['subject' => 'mailto:me@example.com', 'publicKey' => $keys['VAPID_PUBLIC_KEY'], 'privateKey' => $keys['VAPID_PRIVATE_KEY']]);
        $this->assertSame(65, strlen($validated['publicKey'])); // uncompressed P-256 point
        $this->assertSame(32, strlen($validated['privateKey']));
    }
}

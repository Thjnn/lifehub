<?php

namespace App\Services\Push;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Deadline reminders (spec §15.2): open tasks due in the next 3 days, one combined notification per user,
 * twice a day around 08:00 and 20:00 in the user's timezone. Called hourly by a GitHub Actions cron.
 *
 * A slot stays open until noon / midnight, so a cron run that is late or skipped is made up by the next one;
 * `last_reminder_slot` makes sure each slot is sent at most once.
 */
class DeadlineReminders
{
    private const DAYS_AHEAD = 3;

    private const SHOWN = 3; // titles in the notification body; the rest are counted

    public function __construct(private PushSender $sender) {}

    /**
     * @return array{users: int, sent: int, expired: int}
     */
    public function run(): array
    {
        $stats = ['users' => 0, 'sent' => 0, 'expired' => 0];

        User::whereHas('pushSubscriptions')->with(['settings', 'pushSubscriptions'])->chunkById(100, function ($users) use (&$stats) {
            foreach ($users as $user) {
                $timezone = $user->settings?->timezone ?? config('app.timezone');
                $slot = $this->slot(now($timezone));
                if ($slot === null || $user->settings?->last_reminder_slot === $slot) {
                    continue;
                }

                // Mark first: a run that overlaps this one won't send the same slot again.
                // ponytail: no lock between truly simultaneous runs; cron runs are an hour apart.
                $user->settings?->forceFill(['last_reminder_slot' => $slot])->save();

                $tasks = $this->dueTasks($user);
                if ($tasks->isEmpty()) {
                    continue; // nothing due: no notification at all
                }

                $payload = json_encode($this->message($tasks, $timezone), JSON_UNESCAPED_UNICODE);
                $stats['users']++;
                foreach ($user->pushSubscriptions as $subscription) {
                    $result = $this->sender->send($subscription, $payload);
                    if ($result === 'expired') {
                        $subscription->delete();
                        $stats['expired']++;
                    } elseif ($result === 'sent') {
                        $stats['sent']++;
                    }
                }
            }
        });

        return $stats;
    }

    /**
     * "2026-10-24-am" from 08:00 to noon, "-pm" from 20:00 to midnight (user's local time), else none.
     */
    public function slot(Carbon $local): ?string
    {
        return match (true) {
            $local->hour >= 8 && $local->hour < 12 => $local->toDateString().'-am',
            $local->hour >= 20 => $local->toDateString().'-pm',
            default => null,
        };
    }

    /**
     * @return Collection<int, Task>
     */
    public function dueTasks(User $user): Collection
    {
        return $user->tasks()
            ->whereIn('status', array_map(fn (TaskStatus $s) => $s->value, TaskStatus::open()))
            ->whereBetween('due_at', [now()->utc(), now()->addDays(self::DAYS_AHEAD)->utc()])
            ->orderBy('due_at')
            ->get();
    }

    /**
     * @param  Collection<int, Task>  $tasks
     * @return array{title: string, body: string, url: string, tag: string}
     */
    private function message(Collection $tasks, string $timezone): array
    {
        $today = now($timezone)->startOfDay();
        $when = function (Task $task) use ($today, $timezone) {
            $due = $task->due_at->copy()->setTimezone($timezone);

            return match ((int) $today->diffInDays($due->copy()->startOfDay())) {
                0 => 'hôm nay '.$due->format('H:i'),
                1 => 'mai '.$due->format('H:i'),
                default => $due->format('d/m H:i'),
            };
        };

        $lines = $tasks->take(self::SHOWN)->map(fn (Task $t) => mb_strimwidth($t->title, 0, 60, '…').' ('.$when($t).')')->implode(', ');
        $more = $tasks->count() - self::SHOWN;

        return [
            'title' => "Bạn có {$tasks->count()} việc sắp đến hạn",
            'body' => $lines.($more > 0 ? " và {$more} việc khác" : ''),
            'url' => '/app/tasks?view=upcoming',
            'tag' => 'deadlines', // replaces the previous reminder on the device instead of stacking
        ];
    }
}

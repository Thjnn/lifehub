<?php

namespace App\Services\Planning;

use App\Models\Event;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use RRule\RRule;

/**
 * Expands events (including RRULE series) into concrete occurrences for a time range (spec §9.2: expand on the backend).
 * Used both for listing and for the overlap warning, so both always agree.
 */
class EventOccurrences
{
    // Guards against rules like FREQ=DAILY with no end exploding a year-long query.
    private const MAX_PER_SERIES = 400;

    /**
     * @return Collection<int, array{event: Event, start: Carbon, end: Carbon}>
     */
    public function between(User $user, Carbon $from, Carbon $to, ?string $type = null, ?int $exceptEventId = null): Collection
    {
        $events = $user->events()
            ->when($type, fn ($q) => $q->where('event_type', $type))
            ->when($exceptEventId, fn ($q) => $q->whereKeyNot($exceptEventId))
            ->where('start_at', '<', $to)
            // One-off events must also end after the range starts; a series may have started long before.
            ->where(fn ($q) => $q->whereNotNull('recurrence_rule')->orWhere('end_at', '>', $from))
            ->get();

        // Expand in the user's timezone so "every Monday 06:00" stays Monday even though 06:00+07:00 is Sunday in UTC.
        $timezone = $user->settings?->timezone ?? config('app.timezone');

        return $events
            ->flatMap(fn (Event $event) => $this->occurrencesOf($event, $from, $to, $timezone))
            ->sortBy(fn (array $o) => $o['start'])
            ->values();
    }

    /**
     * @return list<array{event: Event, start: Carbon, end: Carbon}>
     */
    private function occurrencesOf(Event $event, Carbon $from, Carbon $to, string $timezone): array
    {
        if (! $event->recurrence_rule) {
            return [['event' => $event, 'start' => $event->start_at, 'end' => $event->end_at]];
        }

        $duration = $event->start_at->diffInSeconds($event->end_at);
        $rule = new RRule($event->recurrence_rule, $event->start_at->copy()->setTimezone($timezone));

        // Start the search one duration early so an occurrence that began before $from but is still running is included.
        $starts = $rule->getOccurrencesBetween($from->copy()->subSeconds($duration), $to, self::MAX_PER_SERIES);

        return collect($starts)
            ->map(function (\DateTimeInterface $start) use ($event, $duration) {
                $start = Carbon::instance($start)->utc();

                return ['event' => $event, 'start' => $start, 'end' => $start->copy()->addSeconds($duration)];
            })
            ->filter(fn (array $o) => $o['end'] > $from && $o['start'] < $to)
            ->values()
            ->all();
    }
}

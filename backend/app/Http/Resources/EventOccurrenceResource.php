<?php

namespace App\Http\Resources;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * One concrete occurrence. start_at/end_at are this occurrence; series_* are what the edit form shows
 * (editing changes the whole series in the MVP).
 *
 * @property array{event: Event, start: Carbon, end: Carbon} $resource
 */
class EventOccurrenceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        ['event' => $event, 'start' => $start, 'end' => $end] = $this->resource;

        return [
            'key' => $event->id.'@'.$start->getTimestamp(),
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'event_type' => $event->event_type,
            'status' => $event->status,
            'start_at' => $start->toIso8601String(),
            'end_at' => $end->toIso8601String(),
            'recurrence_rule' => $event->recurrence_rule,
            'series_start_at' => $event->start_at->toIso8601String(),
            'series_end_at' => $event->end_at->toIso8601String(),
        ];
    }
}

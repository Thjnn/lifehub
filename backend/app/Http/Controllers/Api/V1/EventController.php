<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EventStatus;
use App\Enums\EventType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\EventRequest;
use App\Http\Resources\EventOccurrenceResource;
use App\Models\Event;
use App\Services\Planning\EventOccurrences;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EventController extends Controller
{
    public function __construct(private EventOccurrences $occurrences) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
            'type' => ['sometimes', Rule::enum(EventType::class)],
        ]);

        // Queries compare in UTC; a +07:00 Carbon would be bound as local wall-clock time.
        $from = Carbon::parse($data['from'])->utc();
        $to = Carbon::parse($data['to'])->utc();

        if ($from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['to' => 'Khoảng thời gian tối đa 1 năm.']);
        }

        return EventOccurrenceResource::collection(
            $this->occurrences->between($request->user(), $from, $to, $data['type'] ?? null),
        );
    }

    public function store(EventRequest $request): JsonResponse
    {
        $event = $request->user()->events()->create($request->validated())->refresh();

        return $this->withOverlaps($event, 201);
    }

    public function update(EventRequest $request, Event $event): JsonResponse
    {
        Gate::authorize('update', $event);

        $event->update($request->validated());

        return $this->withOverlaps($event);
    }

    public function destroy(Event $event): Response
    {
        Gate::authorize('delete', $event);

        $event->delete();

        return response()->noContent();
    }

    /**
     * Overlaps are a warning, never a block (spec §9.2). Checked for the first occurrence of the saved event.
     */
    private function withOverlaps(Event $event, int $status = 200): JsonResponse
    {
        $overlaps = $event->status === EventStatus::Cancelled
            ? collect()
            : $this->occurrences
                ->between($event->user, $event->start_at, $event->end_at, exceptEventId: $event->id)
                ->reject(fn (array $o) => $o['event']->status === EventStatus::Cancelled)
                ->values();

        return (new EventOccurrenceResource(['event' => $event, 'start' => $event->start_at, 'end' => $event->end_at]))
            ->additional(['meta' => ['overlaps' => EventOccurrenceResource::collection($overlaps)->resolve()]])
            ->response()
            ->setStatusCode($status);
    }
}

<?php

namespace App\Http\Requests\Events;

use App\Enums\EventStatus;
use App\Enums\EventType;
use App\Models\Event;
use App\Rules\RecurrenceRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST requires every field; PATCH accepts any subset.
 */
class EventRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('PATCH') ? 'sometimes' : 'required';

        return [
            'title' => [$required, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'start_at' => [$required, 'date'],
            'end_at' => [$required, 'date'],
            'event_type' => [$required, Rule::enum(EventType::class)],
            'status' => ['sometimes', Rule::enum(EventStatus::class)],
            'recurrence_rule' => ['sometimes', 'nullable', 'string', 'max:255', new RecurrenceRule],
        ];
    }

    /**
     * end_at > start_at, checked against the stored values when a PATCH sends only one of them.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->hasAny(['start_at', 'end_at'])) {
                return;
            }

            /** @var Event|null $event */
            $event = $this->route('event');
            $start = $this->input('start_at') ?? $event?->start_at;
            $end = $this->input('end_at') ?? $event?->end_at;

            if ($start && $end && Carbon::parse($end)->lte(Carbon::parse($start))) {
                $validator->errors()->add('end_at', 'Giờ kết thúc phải sau giờ bắt đầu.');
            }
        }];
    }
}

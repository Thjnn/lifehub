<?php

namespace App\Http\Requests\Fitness;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A whole workout with its sets, in order (PUT replaces the sets).
 */
class WorkoutRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'performed_at' => ['required', 'date'],
            'duration_min' => ['nullable', 'integer', 'between:1,600'],
            'note' => ['nullable', 'string', 'max:2000'],
            'event_id' => ['nullable', 'integer', Rule::exists('events', 'id')->where('user_id', $userId)],
            'sets' => ['required', 'array', 'min:1', 'max:80'],
            // A system exercise or one of the user's own
            'sets.*.exercise_id' => ['required', 'integer', Rule::exists('exercises', 'id')->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId))],
            // Each set has reps (strength / bodyweight) or minutes (cardio)
            'sets.*.reps' => ['nullable', 'integer', 'between:1,1000', 'required_without:sets.*.duration_min'],
            'sets.*.weight_kg' => ['nullable', 'numeric', 'between:0,1000'],
            'sets.*.duration_min' => ['nullable', 'numeric', 'gt:0', 'max:1440'],
            'sets.*.distance_km' => ['nullable', 'numeric', 'between:0,500'],
        ];
    }
}

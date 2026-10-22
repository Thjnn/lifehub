<?php

namespace App\Http\Requests\Notes;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT = full representation: the client always sends every field (same payload online and from the offline outbox).
 */
class UpsertNoteRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'title' => ['present', 'nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'pinned' => ['required', 'boolean'],
            // Links must point at the user's own task/event.
            'task_id' => ['present', 'nullable', 'uuid', Rule::exists('tasks', 'id')->where('user_id', $userId)->whereNull('deleted_at')],
            'event_id' => ['present', 'nullable', 'integer', Rule::exists('events', 'id')->where('user_id', $userId)],
            // When the edit was made on the client (offline outbox) — used for last-write-wins.
            'client_updated_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}

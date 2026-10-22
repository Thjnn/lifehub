<?php

namespace App\Http\Requests\Tasks;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListTasksRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'array'],
            'status.*' => [Rule::enum(TaskStatus::class)],
            'priority' => ['sometimes', 'array'],
            'priority.*' => [Rule::enum(TaskPriority::class)],
            'due_from' => ['sometimes', 'date'],
            'due_to' => ['sometimes', 'date', 'after_or_equal:due_from'],
            'overdue' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', Rule::in(['due_at', 'priority', 'created_at'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}

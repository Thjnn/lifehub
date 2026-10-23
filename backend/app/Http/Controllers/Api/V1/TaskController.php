<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\ListTasksRequest;
use App\Http\Requests\Tasks\UpsertTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Note;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    public function index(ListTasksRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();

        $tasks = $request->user()->tasks()
            ->when($filters['status'] ?? null, fn ($q, $statuses) => $q->whereIn('status', $statuses))
            ->when($filters['priority'] ?? null, fn ($q, $priorities) => $q->whereIn('priority', $priorities))
            ->when($filters['due_from'] ?? null, fn ($q, $from) => $q->where('due_at', '>=', Carbon::parse($from)->utc()))
            ->when($filters['due_to'] ?? null, fn ($q, $to) => $q->where('due_at', '<=', Carbon::parse($to)->utc()))
            ->when($request->boolean('overdue'), fn ($q) => $q
                ->where('due_at', '<', now())
                ->whereIn('status', TaskStatus::open()))
            ->when($filters['sort'] ?? 'due_at', fn ($q, $sort) => match ($sort) {
                // Most urgent first, then soonest deadline.
                'priority' => $q->orderByRaw("case priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end")
                    ->orderByRaw('due_at is null')->orderBy('due_at'),
                'created_at' => $q->latest(),
                // Soonest deadline first; tasks without a deadline last.
                default => $q->orderByRaw('due_at is null')->orderBy('due_at')->latest(),
            })
            ->paginate($filters['per_page'] ?? 20);

        return TaskResource::collection($tasks);
    }

    /**
     * Idempotent create-or-update keyed by the client's UUID: retrying the same request never duplicates (spec §6.3).
     */
    public function upsert(UpsertTaskRequest $request, string $id): JsonResponse
    {
        $task = Task::withTrashed()->find($id);

        if ($task) {
            Gate::authorize('update', $task);
            // Edited offline after being deleted elsewhere: report a conflict instead of resurrecting it.
            abort_if($task->trashed(), 409, 'Công việc này đã bị xoá.');

            // Last-write-wins (spec §6.3): an offline edit made before the server's latest change loses.
            // The client can resend without client_updated_at to overwrite on purpose.
            $editedAt = $request->validated('client_updated_at');
            if ($editedAt && $task->updated_at->gt(Carbon::parse($editedAt))) {
                return response()->json([
                    'message' => 'Công việc đã được sửa ở nơi khác sau thay đổi này.',
                    'data' => new TaskResource($task),
                ], 409);
            }
        } else {
            $task = $request->user()->tasks()->make();
            $task->id = $id;
        }

        $task->fill($request->safe()->except('client_updated_at'))->save();

        return (new TaskResource($task))
            ->response()
            ->setStatusCode($task->wasRecentlyCreated ? 201 : 200);
    }

    public function complete(Task $task): TaskResource
    {
        Gate::authorize('update', $task);

        $task->update(['status' => TaskStatus::Completed]);

        return new TaskResource($task);
    }

    public function destroy(Task $task): Response
    {
        Gate::authorize('delete', $task);

        $task->delete();
        // Soft delete skips the FK's nullOnDelete: unlink notes here, or editing them would fail validation.
        // toBase() keeps updated_at, so pending offline note edits don't hit a false last-write-wins conflict.
        Note::where('task_id', $task->id)->toBase()->update(['task_id' => null]);

        return response()->noContent();
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\UpsertNoteRequest;
use App\Http\Resources\NoteResource;
use App\Models\Note;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * Notes (spec §15.3): same offline contract as tasks — client UUID, idempotent PUT, last-write-wins.
 */
class NoteController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = $request->validate(['per_page' => ['sometimes', 'integer', 'between:1,100']])['per_page'] ?? 100;

        // Search and the per-task/event lists are filtered on the client, over the cached list, so they work offline.
        $notes = $request->user()->notes()
            ->orderByDesc('pinned')
            ->latest('updated_at')
            ->paginate($perPage);

        return NoteResource::collection($notes);
    }

    public function upsert(UpsertNoteRequest $request, string $id): JsonResponse
    {
        $note = Note::withTrashed()->find($id);

        if ($note) {
            Gate::authorize('update', $note);
            abort_if($note->trashed(), 409, 'Ghi chú này đã bị xoá.');

            $editedAt = $request->validated('client_updated_at');
            if ($editedAt && $note->updated_at->gt(Carbon::parse($editedAt))) {
                return response()->json([
                    'message' => 'Ghi chú đã được sửa ở nơi khác sau thay đổi này.',
                    'data' => new NoteResource($note),
                ], 409);
            }
        } else {
            $note = $request->user()->notes()->make();
            $note->id = $id;
        }

        $note->fill($request->safe()->except('client_updated_at'))->save();

        return (new NoteResource($note))
            ->response()
            ->setStatusCode($note->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Note $note): Response
    {
        Gate::authorize('delete', $note);

        $note->delete();

        return response()->noContent();
    }
}

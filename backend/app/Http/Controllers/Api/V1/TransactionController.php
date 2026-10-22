<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\UpsertTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Services\Finance\MonthRange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'month' => ['sometimes', 'date_format:Y-m'],
            'account_id' => ['sometimes', 'integer'],
            'category_id' => ['sometimes', 'integer'],
            'type' => ['sometimes', Rule::enum(TransactionType::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = $request->user()->transactions()
            ->when($data['month'] ?? null, function ($q, $month) use ($request) {
                $range = MonthRange::for($request->user(), $month);
                $q->where('occurred_at', '>=', $range->start)->where('occurred_at', '<', $range->end);
            })
            // An account's history includes transfers into it.
            ->when($data['account_id'] ?? null, fn ($q, $id) => $q->where(fn ($q) => $q->where('account_id', $id)->orWhere('to_account_id', $id)))
            ->when($data['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when($data['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->orderByDesc('occurred_at')
            ->orderByDesc('created_at')
            ->paginate($data['per_page'] ?? 50);

        return TransactionResource::collection($transactions);
    }

    /**
     * Idempotent create-or-update keyed by the client's UUID (spec §6.3) — works offline-first in Phase 7.
     */
    public function upsert(UpsertTransactionRequest $request, string $id): JsonResponse
    {
        $transaction = Transaction::withTrashed()->find($id);

        if ($transaction) {
            Gate::authorize('update', $transaction);
            abort_if($transaction->trashed(), 409, 'Giao dịch này đã bị xoá.');
        } else {
            $transaction = $request->user()->transactions()->make();
            $transaction->id = $id;
        }

        // Fill every field so switching type (e.g. transfer → expense) clears the other side's columns.
        $transaction->fill([
            'to_account_id' => null,
            'category_id' => null,
            ...$request->validated(),
        ])->save();

        return (new TransactionResource($transaction))
            ->response()
            ->setStatusCode($transaction->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Online only: deleting money records offline could conflict (spec §6.2).
     */
    public function destroy(Transaction $transaction): Response
    {
        Gate::authorize('delete', $transaction);

        $transaction->delete();

        return response()->noContent();
    }
}

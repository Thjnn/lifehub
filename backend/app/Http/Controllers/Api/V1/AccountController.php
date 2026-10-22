<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\AccountRequest;
use App\Http\Resources\AccountResource;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class AccountController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $accounts = $request->user()->accounts()
            ->withBalance()
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return AccountResource::collection($accounts);
    }

    public function store(AccountRequest $request): JsonResponse
    {
        $account = $request->user()->accounts()->create($request->validated());

        return (new AccountResource($this->withBalance($account)))->response()->setStatusCode(201);
    }

    public function update(AccountRequest $request, Account $account): AccountResource
    {
        Gate::authorize('update', $account);

        $account->update($request->validated());

        return new AccountResource($this->withBalance($account));
    }

    public function destroy(Account $account): Response
    {
        Gate::authorize('delete', $account);

        // Deleting would rewrite history; an account in use is hidden (is_active = false) instead.
        $used = Transaction::withTrashed()
            ->where(fn ($q) => $q->where('account_id', $account->id)->orWhere('to_account_id', $account->id))
            ->exists();
        abort_if($used, 409, 'Tài khoản đã có giao dịch. Hãy ẩn tài khoản thay vì xoá.');

        $account->delete();

        return response()->noContent();
    }

    private function withBalance(Account $account): Account
    {
        return Account::withBalance()->findOrFail($account->id);
    }
}

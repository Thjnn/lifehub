<?php

namespace App\Http\Requests\Finance;

use App\Enums\TransactionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT = full representation (same payload online and from the Phase 7 offline outbox).
 * Never trust IDs from the client (spec §5): accounts and categories must belong to this user.
 */
class UpsertTransactionRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->user()->id;
        $ownAccount = Rule::exists('accounts', 'id')->where('user_id', $userId);
        $isTransfer = $this->input('type') === TransactionType::Transfer->value;

        return [
            'type' => ['required', Rule::enum(TransactionType::class)],
            'account_id' => ['required', 'integer', $ownAccount],
            'to_account_id' => $isTransfer
                ? ['required', 'integer', 'different:account_id', $ownAccount]
                : ['prohibited'],
            'category_id' => $isTransfer
                ? ['prohibited']
                : [
                    'nullable',
                    'integer',
                    // System or own category, and an expense category for an expense (income for income).
                    Rule::exists('categories', 'id')
                        ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId))
                        ->where('type', $this->input('type')),
                ],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
            'occurred_at' => ['required', 'date'],
            'description' => ['present', 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'account_id.exists' => 'Tài khoản không hợp lệ.',
            'to_account_id.exists' => 'Tài khoản nhận không hợp lệ.',
            'to_account_id.different' => 'Tài khoản nhận phải khác tài khoản nguồn.',
            'category_id.exists' => 'Danh mục không hợp lệ cho loại giao dịch này.',
            'amount.gt' => 'Số tiền phải lớn hơn 0.',
        ];
    }
}

<?php

namespace App\Http\Requests\Finance;

use App\Enums\AccountType;
use App\Models\Account;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST requires the fields; PATCH accepts any subset.
 */
class AccountRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('PATCH') ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'max:100'],
            'account_type' => [$required, Rule::enum(AccountType::class)],
            // May be negative (e.g. a debt); NUMERIC(15,2) range.
            'opening_balance' => ['sometimes', 'numeric', 'decimal:0,2', 'between:-9999999999999.99,9999999999999.99'],
            'is_active' => ['sometimes', 'boolean'],
            // Repayment schedule — only meaningful for debt accounts (checked in after()).
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'due_day' => ['sometimes', 'nullable', 'integer', 'between:1,31'],
            'installment_amount' => ['sometimes', 'nullable', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var Account|null $account */
            $account = $this->route('account');
            $type = $this->input('account_type') ?? $account?->account_type?->value;
            $dueDate = $this->has('due_date') ? $this->input('due_date') : $account?->due_date;
            $dueDay = $this->has('due_day') ? $this->input('due_day') : $account?->due_day;

            if ($dueDate && $dueDay) {
                $validator->errors()->add('due_day', 'Chọn một: hạn một lần hoặc hằng tháng.');
            }
            $hasSchedule = $dueDate || $dueDay || $this->filled('installment_amount');
            if ($hasSchedule && ! AccountType::tryFrom((string) $type)?->isDebt()) {
                $validator->errors()->add('account_type', 'Lịch trả chỉ dùng cho tài khoản nợ hoặc cho vay.');
            }
        }];
    }
}

<?php

namespace App\Http\Requests\Finance;

use App\Enums\AccountType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            // May be negative (e.g. a credit balance); NUMERIC(15,2) range.
            'opening_balance' => ['sometimes', 'numeric', 'decimal:0,2', 'between:-9999999999999.99,9999999999999.99'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}

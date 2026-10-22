<?php

namespace Database\Factories;

use App\Enums\TransactionType;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'user_id' => fn (array $attributes) => Account::find($attributes['account_id'])->user_id,
            'type' => TransactionType::Expense,
            'amount' => '50000.00',
            'occurred_at' => now(),
            'description' => null,
        ];
    }
}

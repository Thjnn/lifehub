<?php

namespace Database\Factories;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->randomElement(['Tiền mặt', 'Vietcombank', 'MoMo']),
            'account_type' => AccountType::Cash,
            'opening_balance' => '0.00',
            'is_active' => true,
        ];
    }
}

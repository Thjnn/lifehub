<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $cash;

    private Account $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->cash = Account::factory()->for($this->user)->create(['name' => 'Tiền mặt', 'opening_balance' => '1000000.00']);
        $this->bank = Account::factory()->for($this->user)->create(['name' => 'Vietcombank', 'opening_balance' => '5000000.00']);
    }

    private function category(string $name): Category
    {
        return Category::whereNull('user_id')->where('name', $name)->firstOrFail();
    }

    private function saveTransaction(array $payload, ?string $id = null)
    {
        return $this->actingAs($this->user)->putJson('/api/v1/transactions/'.($id ?? Str::uuid()), $payload + [
            'occurred_at' => '2026-10-20T12:00:00+07:00',
            'description' => null,
        ]);
    }

    private function balances(): array
    {
        return collect($this->actingAs($this->user)->getJson('/api/v1/accounts')->json('data'))
            ->pluck('balance', 'name')
            ->all();
    }

    public function test_system_categories_are_seeded_and_visible(): void
    {
        $this->actingAs($this->user)->getJson('/api/v1/categories')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonPath('data.0.is_system', true);

        $this->actingAs($this->user)->getJson('/api/v1/categories?type=income')->assertJsonCount(1, 'data');
    }

    public function test_balances_follow_income_expense_and_transfers(): void
    {
        $this->saveTransaction(['type' => 'income', 'account_id' => $this->bank->id, 'category_id' => $this->category('Thu nhập')->id, 'amount' => '3000000'])->assertCreated();
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'category_id' => $this->category('Ăn uống')->id, 'amount' => '45000.50'])->assertCreated();
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $this->cash->id, 'amount' => '500000'])->assertCreated();

        $this->assertSame([
            'Tiền mặt' => '1454999.50', // 1,000,000 − 45,000.50 + 500,000
            'Vietcombank' => '7500000.00', // 5,000,000 + 3,000,000 − 500,000
        ], $this->balances());
    }

    public function test_a_transfer_does_not_change_total_wealth(): void
    {
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $this->cash->id, 'amount' => '2000000']);

        $total = array_reduce($this->balances(), fn ($sum, $b) => bcadd($sum, $b, 2), '0');
        $this->assertSame('6000000.00', $total);
    }

    public function test_deleted_transactions_do_not_count(): void
    {
        $id = (string) Str::uuid();
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '100000'], $id);

        $this->actingAs($this->user)->deleteJson("/api/v1/transactions/{$id}")->assertNoContent();

        $this->assertSame('1000000.00', $this->balances()['Tiền mặt']);
    }

    public function test_put_is_idempotent_and_switching_type_clears_the_other_side(): void
    {
        $id = (string) Str::uuid();
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $this->cash->id, 'amount' => '100'], $id)->assertCreated();
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->bank->id, 'amount' => '100'], $id)
            ->assertOk()
            ->assertJsonPath('data.to_account_id', null);

        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_cannot_use_another_users_account_or_category(): void
    {
        $theirAccount = Account::factory()->create();
        $theirCategory = Category::create(['name' => 'Riêng', 'type' => 'expense']);
        $theirCategory->user_id = $theirAccount->user_id;
        $theirCategory->save();

        $this->saveTransaction(['type' => 'expense', 'account_id' => $theirAccount->id, 'amount' => '1'])
            ->assertJsonValidationErrors('account_id');
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->cash->id, 'to_account_id' => $theirAccount->id, 'amount' => '1'])
            ->assertJsonValidationErrors('to_account_id');
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'category_id' => $theirCategory->id, 'amount' => '1'])
            ->assertJsonValidationErrors('category_id');
    }

    public function test_validation_rules(): void
    {
        // Income category on an expense
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'category_id' => $this->category('Thu nhập')->id, 'amount' => '1'])
            ->assertJsonValidationErrors('category_id');
        // Transfer: needs a different destination and no category
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->cash->id, 'amount' => '1'])
            ->assertJsonValidationErrors('to_account_id');
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->cash->id, 'to_account_id' => $this->cash->id, 'amount' => '1'])
            ->assertJsonValidationErrors('to_account_id');
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->cash->id, 'to_account_id' => $this->bank->id, 'category_id' => $this->category('Khác')->id, 'amount' => '1'])
            ->assertJsonValidationErrors('category_id');
        // Amount > 0, at most 2 decimals
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '0'])->assertJsonValidationErrors('amount');
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '1.234'])->assertJsonValidationErrors('amount');
    }

    public function test_month_filter_uses_the_users_timezone(): void
    {
        // 00:30 on 1 Nov in Vietnam is still 31 Oct in UTC — it belongs to November for this user.
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '1', 'occurred_at' => '2026-11-01T00:30:00+07:00']);
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '2', 'occurred_at' => '2026-10-31T23:30:00+07:00']);

        $this->actingAs($this->user)->getJson('/api/v1/transactions?month=2026-11')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.amount', '1.00');
        $this->actingAs($this->user)->getJson('/api/v1/transactions?month=2026-10')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.amount', '2.00');
    }

    public function test_account_filter_includes_incoming_transfers(): void
    {
        $this->saveTransaction(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $this->cash->id, 'amount' => '1']);
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->bank->id, 'amount' => '2']);

        $this->actingAs($this->user)->getJson("/api/v1/transactions?account_id={$this->cash->id}")->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson("/api/v1/transactions?account_id={$this->bank->id}")->assertJsonCount(2, 'data');
    }

    public function test_accounts_in_use_are_hidden_not_deleted(): void
    {
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '1']);

        $this->actingAs($this->user)->deleteJson("/api/v1/accounts/{$this->cash->id}")->assertConflict();
        $this->actingAs($this->user)->patchJson("/api/v1/accounts/{$this->cash->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.balance', '999999.00');

        $unused = Account::factory()->for($this->user)->create();
        $this->actingAs($this->user)->deleteJson("/api/v1/accounts/{$unused->id}")->assertNoContent();
    }

    public function test_categories_system_read_only_and_in_use_protected(): void
    {
        $this->actingAs($this->user)->patchJson('/api/v1/categories/'.$this->category('Gym')->id, ['name' => 'x'])->assertForbidden();

        $id = $this->actingAs($this->user)->postJson('/api/v1/categories', ['name' => 'Cà phê', 'type' => 'expense'])
            ->assertCreated()
            ->assertJsonPath('data.is_system', false)
            ->json('data.id');

        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'category_id' => $id, 'amount' => '30000']);
        $this->actingAs($this->user)->deleteJson("/api/v1/categories/{$id}")->assertConflict();
        $this->actingAs($this->user)->patchJson("/api/v1/categories/{$id}", ['name' => 'Cafe'])->assertOk();
        $this->actingAs($this->user)->patchJson("/api/v1/categories/{$id}", ['type' => 'income'])->assertJsonValidationErrors('type');
    }

    public function test_cannot_touch_another_users_records(): void
    {
        $theirs = Transaction::factory()->create();
        $theirAccount = Account::find($theirs->account_id);

        $this->actingAs($this->user)->getJson('/api/v1/transactions')->assertJsonCount(0, 'data');
        $this->actingAs($this->user)->getJson('/api/v1/accounts')->assertJsonCount(2, 'data');
        $this->saveTransaction(['type' => 'expense', 'account_id' => $this->cash->id, 'amount' => '1'], $theirs->id)->assertForbidden();
        $this->actingAs($this->user)->deleteJson("/api/v1/transactions/{$theirs->id}")->assertForbidden();
        $this->actingAs($this->user)->patchJson("/api/v1/accounts/{$theirAccount->id}", ['name' => 'x'])->assertForbidden();
    }
}

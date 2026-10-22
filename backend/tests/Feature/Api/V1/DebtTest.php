<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DebtTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-10-22 10:00:00'); // UTC; 17:00 in Vietnam
        $this->user = User::factory()->create();
        $this->bank = Account::factory()->for($this->user)->create(['name' => 'Vietcombank', 'opening_balance' => '5000000']);
    }

    private function debt(array $attributes): Account
    {
        $id = $this->actingAs($this->user)->postJson('/api/v1/accounts', $attributes)->assertCreated()->json('data.id');

        return Account::findOrFail($id);
    }

    private function move(array $payload): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/transactions/'.Str::uuid(), $payload + [
            'occurred_at' => '2026-10-22T09:00:00+07:00',
            'description' => null,
        ])->assertCreated();
    }

    private function due(string $from, string $to): array
    {
        return $this->actingAs($this->user)->getJson("/api/v1/debts/due?from={$from}&to={$to}")->assertOk()->json('data');
    }

    public function test_bnpl_purchase_is_spending_once_and_instalments_are_not(): void
    {
        $spaylater = $this->debt(['name' => 'SPayLater', 'account_type' => 'liability', 'due_day' => 10, 'installment_amount' => '300000']);
        $clothes = Category::whereNull('user_id')->where('name', 'Khác')->value('id');

        // Buy 900k on SPayLater, then pay one 300k instalment from the bank
        $this->move(['type' => 'expense', 'account_id' => $spaylater->id, 'category_id' => $clothes, 'amount' => '900000']);
        $this->move(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $spaylater->id, 'amount' => '300000']);

        $this->actingAs($this->user)->getJson('/api/v1/reports/finance?month=2026-10')
            ->assertJsonPath('data.expense', '900000.00'); // not 1,200,000

        $balances = collect($this->actingAs($this->user)->getJson('/api/v1/accounts')->json('data'))->pluck('balance', 'name');
        $this->assertSame('-600000.00', $balances['SPayLater']);
        $this->assertSame('4700000.00', $balances['Vietcombank']);
    }

    public function test_monthly_schedule_with_paid_and_overdue_items(): void
    {
        $spaylater = $this->debt(['name' => 'SPayLater', 'account_type' => 'liability', 'opening_balance' => '-900000', 'due_day' => 10, 'installment_amount' => '300000']);
        // Account created today (22 Oct), so the first due date is 10 Nov
        $items = $this->due('2026-10-01', '2026-12-31');
        $this->assertSame(['2026-11-10', '2026-12-10'], array_column($items, 'due_date'));
        $this->assertSame('300000.00', $items[0]['amount']);
        $this->assertFalse($items[0]['paid']);

        // Pay November's instalment early (5 Nov)
        $this->move(['type' => 'transfer', 'account_id' => $this->bank->id, 'to_account_id' => $spaylater->id, 'amount' => '300000', 'occurred_at' => '2026-11-05T12:00:00+07:00']);
        $items = $this->due('2026-11-01', '2026-12-31');
        $this->assertTrue($items[0]['paid']);
        $this->assertFalse($items[1]['paid']);

        // Late January: December's instalment is overdue
        $this->travelTo('2027-01-20 10:00:00');
        $dec = collect($this->due('2026-12-01', '2026-12-31'))->firstWhere('due_date', '2026-12-10');
        $this->assertTrue($dec['overdue']);
    }

    public function test_day_31_is_clamped_to_short_months(): void
    {
        $this->debt(['name' => 'Thẻ tín dụng', 'account_type' => 'liability', 'opening_balance' => '-1000000', 'due_day' => 31]);

        $this->assertSame(
            ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'],
            array_column($this->due('2026-11-01', '2027-02-28'), 'due_date'),
        );
    }

    public function test_one_off_debt_and_money_lent(): void
    {
        $this->debt(['name' => 'Nợ Minh', 'account_type' => 'liability', 'opening_balance' => '-2000000', 'due_date' => '2026-11-15']);
        $lan = $this->debt(['name' => 'Lan mượn', 'account_type' => 'receivable', 'opening_balance' => '500000', 'due_date' => '2026-10-30']);

        $items = $this->due('2026-10-01', '2026-11-30');
        $this->assertSame(['Lan mượn', 'Nợ Minh'], array_column($items, 'account_name'));
        $this->assertSame('500000.00', $items[0]['amount']);

        // Lan pays back in full → nothing due any more
        $this->move(['type' => 'transfer', 'account_id' => $lan->id, 'to_account_id' => $this->bank->id, 'amount' => '500000']);
        $this->assertSame(['Nợ Minh'], array_column($this->due('2026-10-01', '2026-11-30'), 'account_name'));
    }

    public function test_schedule_validation(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/accounts', ['name' => 'Ví', 'account_type' => 'cash', 'due_day' => 10])
            ->assertJsonValidationErrors('account_type');
        $this->actingAs($this->user)->postJson('/api/v1/accounts', ['name' => 'X', 'account_type' => 'liability', 'due_day' => 10, 'due_date' => '2026-11-01'])
            ->assertJsonValidationErrors('due_day');
        $this->actingAs($this->user)->postJson('/api/v1/accounts', ['name' => 'X', 'account_type' => 'liability', 'due_day' => 32])
            ->assertJsonValidationErrors('due_day');
    }

    public function test_due_items_are_private(): void
    {
        $this->debt(['name' => 'SPayLater', 'account_type' => 'liability', 'opening_balance' => '-900000', 'due_day' => 10]);
        $other = User::factory()->create();

        $this->actingAs($other)->getJson('/api/v1/debts/due?from=2026-10-01&to=2026-12-31')->assertJsonCount(0, 'data');
    }
}

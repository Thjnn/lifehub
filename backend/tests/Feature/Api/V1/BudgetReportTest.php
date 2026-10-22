<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BudgetReportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $cash;

    private Account $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->cash = Account::factory()->for($this->user)->create();
        $this->bank = Account::factory()->for($this->user)->create();
    }

    private function categoryId(string $name): int
    {
        return Category::whereNull('user_id')->where('name', $name)->value('id');
    }

    private function record(string $type, string $amount, ?string $category = null, string $at = '2026-10-15T12:00:00+07:00', array $extra = []): void
    {
        $this->actingAs($this->user)->putJson('/api/v1/transactions/'.Str::uuid(), [
            'type' => $type,
            'account_id' => $this->cash->id,
            'category_id' => $category ? $this->categoryId($category) : null,
            'amount' => $amount,
            'occurred_at' => $at,
            'description' => null,
        ] + $extra)->assertCreated();
    }

    public function test_report_totals_exclude_transfers_and_compare_with_last_month(): void
    {
        $this->record('income', '10000000', 'Thu nhập');
        $this->record('expense', '1200000', 'Ăn uống');
        $this->record('expense', '300000.50', 'Ăn uống');
        $this->record('expense', '500000', 'Đi lại');
        $this->record('expense', '100000'); // uncategorised
        $this->actingAs($this->user)->putJson('/api/v1/transactions/'.Str::uuid(), [
            'type' => 'transfer', 'account_id' => $this->cash->id, 'to_account_id' => $this->bank->id,
            'amount' => '9999999', 'occurred_at' => '2026-10-16T12:00:00+07:00', 'description' => null,
        ])->assertCreated();
        $this->record('expense', '400000', 'Ăn uống', '2026-09-20T12:00:00+07:00'); // previous month

        $this->actingAs($this->user)->getJson('/api/v1/reports/finance?month=2026-10')
            ->assertOk()
            ->assertJsonPath('data.income', '10000000.00')
            ->assertJsonPath('data.expense', '2100000.50') // transfer of 9,999,999 not counted
            ->assertJsonPath('data.net', '7899999.50')
            ->assertJsonPath('data.previous.expense', '400000.00')
            ->assertJsonPath('data.by_category.0.category_id', $this->categoryId('Ăn uống'))
            ->assertJsonPath('data.by_category.0.amount', '1500000.50')
            ->assertJsonCount(3, 'data.by_category');
    }

    public function test_budgets_track_spending_and_percent(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'category_id' => $this->categoryId('Ăn uống'), 'amount' => '2000000'])
            ->assertCreated()
            ->assertJsonPath('data.period_start', '2026-10-01')
            ->assertJsonPath('data.period_end', '2026-10-31');
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'category_id' => null, 'amount' => '3000000'])->assertCreated();

        $this->record('expense', '1700000', 'Ăn uống');
        $this->record('expense', '1600000', 'Đi lại');

        $data = $this->actingAs($this->user)->getJson('/api/v1/budgets?month=2026-10')->assertOk()->json('data');

        // Overall budget first: 3,300,000 of 3,000,000 = 110% (over)
        $this->assertSame(['spent' => '3300000.00', 'remaining' => '-300000.00', 'percent' => 110], array_intersect_key($data[0], array_flip(['spent', 'remaining', 'percent'])));
        // Food: 1,700,000 of 2,000,000 = 85% (warning)
        $this->assertSame(['spent' => '1700000.00', 'remaining' => '300000.00', 'percent' => 85], array_intersect_key($data[1], array_flip(['spent', 'remaining', 'percent'])));
    }

    public function test_one_budget_per_category_and_month_including_the_overall_one(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'amount' => '1'])->assertCreated();
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'amount' => '2'])
            ->assertJsonValidationErrors('category_id');
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-11', 'amount' => '2'])->assertCreated();
    }

    public function test_only_expense_categories_can_be_budgeted(): void
    {
        $this->actingAs($this->user)->postJson('/api/v1/budgets', ['month' => '2026-10', 'category_id' => $this->categoryId('Thu nhập'), 'amount' => '1'])
            ->assertJsonValidationErrors('category_id');
    }

    public function test_budgets_and_reports_are_private(): void
    {
        $other = User::factory()->create();
        $id = $this->actingAs($other)->postJson('/api/v1/budgets', ['month' => '2026-10', 'amount' => '5'])->json('data.id');

        $this->actingAs($this->user)->getJson('/api/v1/budgets?month=2026-10')->assertJsonCount(0, 'data');
        $this->actingAs($this->user)->patchJson("/api/v1/budgets/{$id}", ['amount' => '1'])->assertForbidden();
        $this->actingAs($this->user)->deleteJson("/api/v1/budgets/{$id}")->assertForbidden();
        $this->record('expense', '777');
        $this->actingAs($other)->getJson('/api/v1/reports/finance?month=2026-10')->assertJsonPath('data.expense', '0.00');
    }
}

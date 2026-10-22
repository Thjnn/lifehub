<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\Category;
use App\Models\Task;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_contains_only_the_users_own_data(): void
    {
        $user = User::factory()->create();
        Task::factory()->for($user)->create(['title' => 'Của tôi']);
        Task::factory()->for(User::factory())->create(['title' => 'Của người khác']);

        $this->actingAs($user)->getJson('/api/v1/privacy/export')
            ->assertOk()
            ->assertHeader('Content-Disposition')
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonMissingPath('user.password')
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.title', 'Của tôi');
    }

    public function test_delete_account_needs_the_password_and_removes_everything(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $category = Category::create(['name' => 'Riêng', 'type' => 'expense']);
        $category->user_id = $user->id;
        $category->save();
        Transaction::factory()->create(['account_id' => $account->id, 'category_id' => $category->id]);
        Transaction::factory()->create(['account_id' => $account->id])->delete(); // soft-deleted still blocks the account
        $token = $user->createToken('web')->plainTextToken;
        $other = Task::factory()->create();

        $this->withToken($token)->deleteJson('/api/v1/me', ['password' => 'wrong'])->assertUnprocessable();
        $this->withToken($token)->deleteJson('/api/v1/me', ['password' => 'password'])->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('accounts', ['id' => $account->id]);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('tasks', ['id' => $other->id]);
    }
}

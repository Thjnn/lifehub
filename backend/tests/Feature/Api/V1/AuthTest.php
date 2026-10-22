<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_user_with_default_settings_and_returns_token(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Minh',
            'email' => 'minh@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'device_name' => 'Chrome on Windows',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.email', 'minh@example.com')
            ->assertJsonPath('data.user.settings.timezone', 'Asia/Ho_Chi_Minh')
            ->assertJsonPath('data.user.settings.currency', 'VND');
        $this->assertNotEmpty($response->json('data.token'));
        $this->assertDatabaseHas('personal_access_tokens', ['name' => 'Chrome on Windows']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'minh@example.com']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Minh',
            'email' => 'minh@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'device_name' => 'test',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_login_returns_token(): void
    {
        $user = User::factory()->create(['password' => 'password123']);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
            'device_name' => 'test',
        ])->assertOk()->assertJsonPath('data.user.id', $user->id);
    }

    public function test_login_rejects_wrong_password(): void
    {
        $user = User::factory()->create(['password' => 'password123']);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
            'device_name' => 'test',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_me_returns_current_user_with_settings(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.settings.locale', 'vi');
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->travel(31)->days();

        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_auth_endpoints_are_rate_limited(): void
    {
        foreach (range(1, 6) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'x', 'device_name' => 'test']);
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'x', 'device_name' => 'test'])
            ->assertTooManyRequests();
    }

    public function test_health_check(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJson(['status' => 'ok']);
    }
}

<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_name_can_be_changed(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson('/api/v1/me', ['name' => 'Tên mới'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Tên mới');
        $this->actingAs($user)->patchJson('/api/v1/me', ['name' => ''])->assertJsonValidationErrors('name');
    }

    public function test_password_change_needs_the_current_one_and_signs_out_other_devices(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('phone')->plainTextToken;
        $user->createToken('laptop');

        $this->withToken($current)->putJson('/api/v1/me/password', ['current_password' => 'wrong', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
            ->assertJsonValidationErrors('current_password');
        $this->withToken($current)->putJson('/api/v1/me/password', ['current_password' => 'password', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
            ->assertNoContent();

        $this->assertTrue(Hash::check('new-password-1', $user->fresh()->password));
        $this->assertSame(['phone'], $user->tokens()->pluck('name')->all());
    }
}

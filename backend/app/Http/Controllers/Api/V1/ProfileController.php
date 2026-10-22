<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rules\Password;

/**
 * Settings → Profile: PATCH /me (name) and PUT /me/password.
 */
class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $request->user()->update($request->validate(['name' => ['required', 'string', 'max:255']]));

        return new UserResource($request->user()->load('settings'));
    }

    public function password(Request $request): Response
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        $user = $request->user();
        $user->update(['password' => $data['password']]);
        // Other devices must sign in again with the new password; this one stays signed in.
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();

        return response()->noContent();
    }
}

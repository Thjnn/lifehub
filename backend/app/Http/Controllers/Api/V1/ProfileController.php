<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rules\Password;

/**
 * Settings → Profile: PATCH /me (name, avatar) and PUT /me/password.
 */
class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $request->user()->update($request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            // Raster data URL only (an SVG could carry script); ~200 KB cap, the client sends far less.
            'avatar' => ['sometimes', 'nullable', 'string', 'max:200000', 'regex:#^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$#'],
        ]));

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

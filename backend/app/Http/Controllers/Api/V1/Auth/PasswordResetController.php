<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'string', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_THROTTLED) {
            throw ValidationException::withMessages([
                'email' => 'Bạn vừa yêu cầu rồi, vui lòng thử lại sau ít phút.',
            ]);
        }

        // Same answer whether or not the email exists, so the endpoint can't be used to probe accounts.
        return response()->json([
            'message' => 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.',
        ]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->validated(),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                // Sign out every device that might hold an old token.
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
            ]);
        }

        return response()->json(['message' => 'Đã đặt lại mật khẩu. Hãy đăng nhập lại.']);
    }
}

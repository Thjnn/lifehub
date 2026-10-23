<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\Push\DeadlineReminders;
use App\Services\Push\PushSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Deadline reminders by Web Push (spec §15.2): devices subscribe here; the cron endpoint sends.
 */
class PushController extends Controller
{
    // GET /push/key — the VAPID public key the browser subscribes with (null = reminders not set up on the server)
    public function key(PushSender $sender): JsonResponse
    {
        return response()->json(['data' => ['public_key' => $sender->configured() ? config('services.webpush.public_key') : null]]);
    }

    // POST /push/subscriptions — this device switched reminders on
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:1000', 'starts_with:https://'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
        ]);

        // One device = one endpoint. Signing in with another account on the same browser moves it to that account.
        $subscription = PushSubscription::firstOrNew(['endpoint' => $data['endpoint']]);
        $subscription->user_id = $request->user()->id;
        $subscription->fill([
            'public_key' => $data['keys']['p256dh'],
            'auth_token' => $data['keys']['auth'],
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
        ])->save();

        return response()->json(['data' => ['subscribed' => true]], $subscription->wasRecentlyCreated ? 201 : 200);
    }

    // DELETE /push/subscriptions {endpoint} — switched off, or signing out on this device
    public function unsubscribe(Request $request): Response
    {
        $endpoint = $request->validate(['endpoint' => ['required', 'string', 'max:1000']])['endpoint'];
        $request->user()->pushSubscriptions()->where('endpoint', $endpoint)->delete();

        return response()->noContent();
    }

    // POST /api/internal/reminders — called hourly by GitHub Actions with the shared secret
    public function reminders(Request $request, DeadlineReminders $reminders, PushSender $sender): JsonResponse
    {
        $secret = (string) config('services.reminders.secret');
        abort_unless($secret !== '' && hash_equals($secret, (string) $request->header('X-Reminder-Secret')), 401, 'Unauthorized.');
        abort_unless($sender->configured(), 503, 'Web Push chưa được cấu hình (thiếu VAPID_*).');

        return response()->json(['data' => $reminders->run()]);
    }
}

<?php

namespace App\Services\Push;

use App\Models\PushSubscription;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Sends one Web Push message (VAPID, encrypted payload). Swapped for a fake in tests.
 */
class PushSender
{
    private ?WebPush $webPush = null;

    public function configured(): bool
    {
        return filled(config('services.webpush.public_key')) && filled(config('services.webpush.private_key')) && filled(config('services.webpush.subject'));
    }

    /**
     * @return 'sent'|'expired'|'failed' expired = the device unsubscribed (404/410): forget it
     */
    public function send(PushSubscription $subscription, string $payload): string
    {
        $this->webPush ??= new WebPush(
            ['VAPID' => [
                'subject' => config('services.webpush.subject'),
                'publicKey' => config('services.webpush.public_key'),
                'privateKey' => config('services.webpush.private_key'),
            ]],
            // TTL: a reminder older than 6 hours isn't worth showing; topic: a newer one replaces a pending one.
            ['TTL' => 6 * 3600, 'urgency' => 'normal', 'topic' => 'deadlines'],
            new Client(['timeout' => 10]),
        );

        $report = $this->webPush->sendOneNotification(Subscription::create([
            'endpoint' => $subscription->endpoint,
            'publicKey' => $subscription->public_key,
            'authToken' => $subscription->auth_token,
            'contentEncoding' => 'aes128gcm',
        ]), $payload);

        if ($report->isSuccess()) {
            return 'sent';
        }
        if ($report->isSubscriptionExpired()) {
            return 'expired';
        }
        // stderr on Render: the push service's reason, without the endpoint (it identifies the device).
        Log::warning('Web push failed', ['status' => $report->getResponse()?->getStatusCode(), 'reason' => mb_substr($report->getReason(), 0, 300)]);

        return 'failed';
    }
}

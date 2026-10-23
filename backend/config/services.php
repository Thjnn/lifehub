<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    // Deadline reminders by Web Push (spec §15.2). Keys from `php artisan push:vapid`; set them on Render, never commit them.
    'webpush' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT'), // mailto:you@example.com — how push services can reach the sender
    ],

    // Shared with the GitHub Actions cron that calls POST /api/internal/reminders (no worker on Render).
    'reminders' => [
        'secret' => env('REMINDER_SECRET'),
    ],

    // AI Coach (spec §9.5). Called from the backend only; the key never reaches the frontend.
    // Google renames models often — set GEMINI_MODEL to a Flash model listed in AI Studio.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        // Flash-Lite by default: its free tier allows far more requests per day than Flash (about 500 vs 20).
        'model' => env('GEMINI_MODEL', 'gemini-flash-lite-latest'),
        // Used when the main model is overloaded or out of quota — quotas are per model.
        'fallback_model' => env('GEMINI_FALLBACK_MODEL', 'gemini-3.8-flash'),
        'timeout' => (int) env('GEMINI_TIMEOUT', 25),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];

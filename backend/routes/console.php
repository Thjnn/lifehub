<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Deadline reminders (spec §15.2): prints a VAPID key pair and a cron secret to paste into Render's Environment.
// Generated here with OpenSSL directly: on Windows PHP, OpenSSL can't create keys unless it's told where openssl.cnf is.
Artisan::command('push:vapid', function () {
    $windowsConfig = PHP_OS_FAMILY === 'Windows' ? ['config' => dirname(PHP_BINARY).'/extras/ssl/openssl.cnf'] : [];
    $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'] + $windowsConfig);
    if ($key === false) {
        $this->error('OpenSSL could not create the key: '.openssl_error_string());

        return 1;
    }

    $ec = openssl_pkey_get_details($key)['ec'];
    $pad = fn (string $bytes) => str_pad($bytes, 32, "\0", STR_PAD_LEFT);
    $base64url = fn (string $bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');

    $this->line('VAPID_PUBLIC_KEY='.$base64url("\x04".$pad($ec['x']).$pad($ec['y']))); // uncompressed P-256 point
    $this->line('VAPID_PRIVATE_KEY='.$base64url($pad($ec['d'])));
    $this->line('VAPID_SUBJECT=mailto:you@example.com');
    $this->line('REMINDER_SECRET='.Str::random(48));
    $this->newLine();
    $this->comment('Paste these into Render > Environment (and backend/.env to try locally). Never commit them.');
    $this->comment('REMINDER_SECRET also goes into GitHub > Settings > Secrets > Actions.');
})->purpose('Create Web Push (VAPID) keys and a reminder cron secret');

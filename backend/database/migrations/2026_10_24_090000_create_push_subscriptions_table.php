<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Deadline reminders by Web Push (spec §15.2).
     */
    public function up(): void
    {
        // One row per device/browser that switched reminders on.
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->text('endpoint')->unique(); // the push service URL; identifies the device
            $table->string('public_key'); // keys.p256dh
            $table->string('auth_token'); // keys.auth
            $table->string('user_agent')->nullable();
            $table->timestampsTz();
        });

        // The last reminder slot sent ("2026-10-24-am"), so a late or repeated cron run never sends it twice.
        Schema::table('user_settings', function (Blueprint $table) {
            $table->string('last_reminder_slot', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn('last_reminder_slot');
        });
        Schema::dropIfExists('push_subscriptions');
    }
};

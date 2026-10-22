<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            // For a recurring event these are the first occurrence; later ones are expanded from recurrence_rule.
            $table->timestampTz('start_at');
            $table->timestampTz('end_at');
            $table->string('event_type', 20);
            $table->string('status', 20)->default('scheduled');
            $table->string('recurrence_rule')->nullable(); // RFC 5545 RRULE without DTSTART, e.g. FREQ=WEEKLY;UNTIL=20261231T235959Z
            $table->timestampsTz();

            $table->index(['user_id', 'start_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE events ADD CONSTRAINT events_time_check CHECK (end_at > start_at)');
            DB::statement("ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (event_type IN ('study', 'work', 'workout', 'rest', 'personal'))");
            DB::statement("ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};

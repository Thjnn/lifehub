<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations (spec §15.3).
     */
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            // Client-generated UUID, like tasks, so notes written offline sync idempotently.
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->text('body');
            $table->boolean('pinned')->default(false);
            // Optional link; the note survives if the task/event is removed.
            $table->foreignUuid('task_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->foreignId('event_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['user_id', 'pinned', 'updated_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};

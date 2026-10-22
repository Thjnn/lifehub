<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Spec §10 (AI): conversations, messages, action proposals (AI never writes data itself), daily briefings.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ai_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->timestampsTz();
        });

        Schema::create('ai_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->index()->constrained('ai_conversations')->cascadeOnDelete();
            $table->string('role', 10);
            $table->text('content');
            $table->string('model', 64)->nullable();
            $table->jsonb('token_usage')->nullable();
            $table->timestampsTz();
        });

        Schema::create('ai_action_proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('ai_conversations')->nullOnDelete();
            $table->string('action_type', 30);
            $table->jsonb('payload');
            $table->string('status', 12)->default('pending');
            $table->timestampTz('expires_at');
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('ai_daily_briefings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('briefing_date');
            $table->text('content');
            $table->timestampsTz();
            $table->unique(['user_id', 'briefing_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_role_check CHECK (role IN ('user', 'assistant'))");
            DB::statement("ALTER TABLE ai_action_proposals ADD CONSTRAINT ai_proposals_status_check CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_daily_briefings');
        Schema::dropIfExists('ai_action_proposals');
        Schema::dropIfExists('ai_messages');
        Schema::dropIfExists('ai_conversations');
    }
};

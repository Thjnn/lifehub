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
        Schema::create('transactions', function (Blueprint $table) {
            // Client-generated UUID: transactions can be created offline and synced idempotently (spec §6.3).
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // restrict: an account/category in use can't be deleted (it is hidden/kept instead).
            $table->foreignId('account_id')->index()->constrained()->restrictOnDelete();
            $table->foreignId('to_account_id')->nullable()->index()->constrained('accounts')->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('type', 10);
            $table->decimal('amount', 15, 2);
            $table->char('currency', 3)->default('VND');
            $table->timestampTz('occurred_at');
            $table->text('description')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['user_id', 'occurred_at']);
            $table->index(['user_id', 'category_id', 'occurred_at']);
        });

        // Spec §10 business rules, enforced by the database itself.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'transfer'))");
            DB::statement('ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (amount > 0)');
            // transfer ⇔ has a destination, and the destination differs from the source
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_check CHECK ((type = 'transfer') = (to_account_id IS NOT NULL) AND (to_account_id IS NULL OR to_account_id <> account_id))");
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_transfer_category_check CHECK (type <> 'transfer' OR category_id IS NULL)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};

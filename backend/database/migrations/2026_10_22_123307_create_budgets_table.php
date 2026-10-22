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
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // null = overall budget for all spending in the period
            $table->foreignId('category_id')->nullable()->constrained()->cascadeOnDelete();
            // Local calendar dates (MVP: one calendar month)
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('amount', 15, 2);
            $table->char('currency', 3)->default('VND');
            $table->timestampsTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            // NULLS NOT DISTINCT (Postgres 15+): a plain UNIQUE treats NULLs as different, so it would allow
            // two overall (category_id NULL) budgets for the same month.
            DB::statement('ALTER TABLE budgets ADD CONSTRAINT budgets_user_category_period_unique UNIQUE NULLS NOT DISTINCT (user_id, category_id, period_start)');
            DB::statement('ALTER TABLE budgets ADD CONSTRAINT budgets_amount_check CHECK (amount > 0)');
            DB::statement('ALTER TABLE budgets ADD CONSTRAINT budgets_period_check CHECK (period_end >= period_start)');
        } else {
            Schema::table('budgets', fn (Blueprint $table) => $table->unique(['user_id', 'category_id', 'period_start']));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budgets');
    }
};

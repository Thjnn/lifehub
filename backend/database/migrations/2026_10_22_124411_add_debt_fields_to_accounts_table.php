<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Debts & buy-now-pay-later as accounts: a purchase on SPayLater is an expense from a liability account
 * (counted once), paying an instalment is a transfer into it (not spending again).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            // Repayment schedule: either one date, or a day of every month. Instalment amount is optional.
            $table->date('due_date')->nullable()->after('is_active');
            $table->unsignedTinyInteger('due_day')->nullable()->after('due_date');
            $table->decimal('installment_amount', 15, 2)->nullable()->after('due_day');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_type_check');
            DB::statement("ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (account_type IN ('cash', 'bank', 'ewallet', 'liability', 'receivable'))");
            DB::statement('ALTER TABLE accounts ADD CONSTRAINT accounts_due_day_check CHECK (due_day BETWEEN 1 AND 31)');
            DB::statement('ALTER TABLE accounts ADD CONSTRAINT accounts_schedule_check CHECK (due_date IS NULL OR due_day IS NULL)');
            DB::statement('ALTER TABLE accounts ADD CONSTRAINT accounts_installment_check CHECK (installment_amount IS NULL OR installment_amount > 0)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_due_day_check');
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_schedule_check');
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_installment_check');
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_type_check');
            DB::statement("ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (account_type IN ('cash', 'bank', 'ewallet'))");
        }

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['due_date', 'due_day', 'installment_amount']);
        });
    }
};

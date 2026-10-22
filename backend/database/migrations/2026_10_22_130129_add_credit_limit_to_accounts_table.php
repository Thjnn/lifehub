<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Credit limit for liability accounts (SPayLater, credit card): available = limit − what is owed.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->decimal('credit_limit', 15, 2)->nullable()->after('installment_amount');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE accounts ADD CONSTRAINT accounts_credit_limit_check CHECK (credit_limit IS NULL OR credit_limit > 0)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE accounts DROP CONSTRAINT accounts_credit_limit_check');
        }

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('credit_limit');
        });
    }
};

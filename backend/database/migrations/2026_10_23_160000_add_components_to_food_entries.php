<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A scanned plate is one entry (e.g. "Salad ức gà") whose ingredients are kept here; the entry holds the totals.
     */
    public function up(): void
    {
        Schema::table('food_entries', function (Blueprint $table) {
            $table->jsonb('components')->nullable()->after('fat_g');
        });
    }

    public function down(): void
    {
        Schema::table('food_entries', function (Blueprint $table) {
            $table->dropColumn('components');
        });
    }
};

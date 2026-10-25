<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Allergies, dishes to avoid, likes — free text the meal planner sends to Gemini every week.
     */
    public function up(): void
    {
        Schema::table('nutrition_profiles', function (Blueprint $table) {
            $table->string('food_preferences', 500)->nullable()->after('workouts_per_week');
        });
    }

    public function down(): void
    {
        Schema::table('nutrition_profiles', function (Blueprint $table) {
            $table->dropColumn('food_preferences');
        });
    }
};

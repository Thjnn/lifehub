<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Weekly meal plan (spec §15.4): written only when the user confirms an AI proposal.
     */
    public function up(): void
    {
        Schema::create('meal_plan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date'); // calendar day in the user's timezone
            $table->string('meal', 10);
            // Only dishes from the table: nutrition always comes from `foods`, never from the model.
            $table->foreignId('food_id')->constrained('foods')->cascadeOnDelete();
            $table->unsignedSmallInteger('grams');
            $table->decimal('est_cost', 15, 2)->nullable(); // AI estimate, VND
            // Set by "Đã ăn"; deleting that entry puts the item back to "not eaten".
            $table->foreignId('food_entry_id')->nullable()->constrained('food_entries')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['user_id', 'date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_meal_check CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack'))");
            DB::statement('ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_grams_check CHECK (grams > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_plan_items');
    }
};

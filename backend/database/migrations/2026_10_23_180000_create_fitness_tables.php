<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Workouts and body measurements (spec §15.4, schema v2).
     */
    public function up(): void
    {
        Schema::create('exercises', function (Blueprint $table) {
            $table->id();
            // null = shared system exercise (read-only), like system categories
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('kind', 10); // strength (reps × kg) | bodyweight (reps) | cardio (minutes, km)
            $table->string('muscle_group', 20)->nullable();
            $table->timestampsTz();

            $table->index('user_id');
        });

        Schema::create('workouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('performed_at');
            $table->unsignedSmallInteger('duration_min')->nullable();
            $table->text('note')->nullable();
            // Optional link to a "Tập luyện" event in the calendar; the workout survives if the event is removed.
            $table->foreignId('event_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampsTz();

            $table->index(['user_id', 'performed_at']);
        });

        Schema::create('workout_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workout_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // for scoping and the data export
            // Deleting an exercise that is in use is refused in the controller (409); cascade only matters on account deletion.
            $table->foreignId('exercise_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position');
            $table->unsignedSmallInteger('reps')->nullable();
            $table->decimal('weight_kg', 6, 2)->nullable();
            $table->decimal('duration_min', 5, 1)->nullable();
            $table->decimal('distance_km', 6, 2)->nullable();
            $table->timestampsTz();

            $table->index('exercise_id');
        });

        Schema::create('body_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('measured_on'); // calendar day in the user's timezone; one row per day
            $table->decimal('weight_kg', 5, 1);
            $table->decimal('waist_cm', 5, 1)->nullable();
            $table->decimal('body_fat_pct', 4, 1)->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'measured_on']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE exercises ADD CONSTRAINT exercises_kind_check CHECK (kind IN ('strength', 'bodyweight', 'cardio'))");
            DB::statement('ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_effort_check CHECK (reps IS NOT NULL OR duration_min IS NOT NULL)');
        }

        // Reference data lives in the migration (Render only runs `migrate`): [name, kind, muscle group].
        $now = now();
        DB::table('exercises')->insert(array_map(fn (array $e) => [
            'user_id' => null, 'name' => $e[0], 'kind' => $e[1], 'muscle_group' => $e[2], 'created_at' => $now, 'updated_at' => $now,
        ], [
            ['Squat (gánh tạ)', 'strength', 'Chân'],
            ['Deadlift', 'strength', 'Lưng'],
            ['Romanian deadlift', 'strength', 'Chân'],
            ['Leg press', 'strength', 'Chân'],
            ['Lunge', 'strength', 'Chân'],
            ['Bench press (đẩy ngực)', 'strength', 'Ngực'],
            ['Incline dumbbell press', 'strength', 'Ngực'],
            ['Overhead press (đẩy vai)', 'strength', 'Vai'],
            ['Lateral raise (dang vai)', 'strength', 'Vai'],
            ['Barbell row (kéo tạ đòn)', 'strength', 'Lưng'],
            ['Lat pulldown (kéo xà máy)', 'strength', 'Lưng'],
            ['Seated cable row', 'strength', 'Lưng'],
            ['Bicep curl', 'strength', 'Tay'],
            ['Tricep pushdown', 'strength', 'Tay'],
            ['Hip thrust', 'strength', 'Mông'],
            ['Calf raise', 'strength', 'Chân'],
            ['Hít đất (push-up)', 'bodyweight', 'Ngực'],
            ['Hít xà (pull-up)', 'bodyweight', 'Lưng'],
            ['Dips', 'bodyweight', 'Tay'],
            ['Squat không tạ', 'bodyweight', 'Chân'],
            ['Gập bụng (crunch)', 'bodyweight', 'Bụng'],
            ['Plank (giây = số lần)', 'bodyweight', 'Bụng'],
            ['Burpee', 'bodyweight', 'Toàn thân'],
            ['Chạy bộ', 'cardio', 'Cardio'],
            ['Đi bộ nhanh', 'cardio', 'Cardio'],
            ['Đạp xe', 'cardio', 'Cardio'],
            ['Bơi', 'cardio', 'Cardio'],
            ['Nhảy dây', 'cardio', 'Cardio'],
            ['Máy chạy bộ', 'cardio', 'Cardio'],
            ['Cầu lông', 'cardio', 'Cardio'],
            ['Bóng đá', 'cardio', 'Cardio'],
        ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('body_measurements');
        Schema::dropIfExists('workout_sets');
        Schema::dropIfExists('workouts');
        Schema::dropIfExists('exercises');
    }
};

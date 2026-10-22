<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nutrition (spec §15.1, §15.4): profile → targets, a reference table of Vietnamese dishes, and a food log.
     */
    public function up(): void
    {
        Schema::create('nutrition_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('goal', 10); // cut | maintain | bulk
            $table->string('sex', 6); // male | female (Mifflin-St Jeor needs it)
            $table->unsignedSmallInteger('birth_year');
            $table->decimal('weight_kg', 5, 1);
            $table->unsignedSmallInteger('height_cm');
            $table->unsignedTinyInteger('workouts_per_week');
            $table->timestampsTz();
        });

        Schema::create('foods', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('serving', 50); // human text, e.g. "1 tô"
            $table->unsignedSmallInteger('serving_grams');
            // Per serving. Approximate reference values — dishes vary a lot by recipe and portion.
            $table->decimal('kcal', 7, 1);
            $table->decimal('protein_g', 6, 1);
            $table->decimal('carbs_g', 6, 1);
            $table->decimal('fat_g', 6, 1);
            $table->timestampsTz();
        });

        Schema::create('food_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('eaten_at');
            $table->string('meal', 10); // breakfast | lunch | dinner | snack
            $table->foreignId('food_id')->nullable()->constrained('foods')->nullOnDelete();
            $table->string('name', 100);
            $table->decimal('grams', 7, 1)->nullable();
            // Snapshot of the eaten amount: later edits to `foods` never rewrite history.
            $table->decimal('kcal', 7, 1);
            $table->decimal('protein_g', 6, 1);
            $table->decimal('carbs_g', 6, 1);
            $table->decimal('fat_g', 6, 1);
            $table->string('source', 10); // table | manual | scan
            $table->timestampsTz();

            $table->index(['user_id', 'eaten_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE nutrition_profiles ADD CONSTRAINT nutrition_profiles_goal_check CHECK (goal IN ('cut', 'maintain', 'bulk'))");
            DB::statement("ALTER TABLE nutrition_profiles ADD CONSTRAINT nutrition_profiles_sex_check CHECK (sex IN ('male', 'female'))");
            DB::statement("ALTER TABLE food_entries ADD CONSTRAINT food_entries_meal_check CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack'))");
            DB::statement("ALTER TABLE food_entries ADD CONSTRAINT food_entries_source_check CHECK (source IN ('table', 'manual', 'scan'))");
            DB::statement('ALTER TABLE food_entries ADD CONSTRAINT food_entries_nutrition_check CHECK (kcal >= 0 AND protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0)');
        }

        // Reference data lives in the migration (Render only runs `migrate`). Common Vietnamese dishes,
        // rounded reference values per typical serving: [name, serving, grams, kcal, protein, carbs, fat].
        $now = now();
        DB::table('foods')->insert(array_map(fn (array $f) => [
            'name' => $f[0], 'serving' => $f[1], 'serving_grams' => $f[2], 'kcal' => $f[3],
            'protein_g' => $f[4], 'carbs_g' => $f[5], 'fat_g' => $f[6], 'created_at' => $now, 'updated_at' => $now,
        ], [
            ['Phở bò', '1 tô', 500, 450, 25, 55, 12],
            ['Bún bò Huế', '1 tô', 500, 480, 25, 60, 15],
            ['Bún chả', '1 phần', 400, 550, 25, 60, 22],
            ['Bún riêu', '1 tô', 500, 420, 20, 55, 12],
            ['Hủ tiếu Nam Vang', '1 tô', 500, 420, 22, 55, 12],
            ['Mì Quảng', '1 tô', 450, 480, 24, 58, 16],
            ['Cơm tấm sườn', '1 đĩa', 400, 650, 28, 80, 22],
            ['Cơm gà', '1 đĩa', 400, 600, 30, 75, 18],
            ['Cơm chiên dương châu', '1 đĩa', 350, 580, 18, 75, 22],
            ['Cơm trắng', '1 chén', 150, 195, 4, 43, 0.4],
            ['Bánh mì thịt', '1 ổ', 200, 450, 18, 50, 18],
            ['Bánh cuốn', '1 đĩa', 300, 400, 14, 60, 10],
            ['Bánh xèo', '1 cái', 200, 400, 12, 35, 24],
            ['Bánh bao nhân thịt', '1 cái', 150, 330, 12, 45, 11],
            ['Xôi gà', '1 gói', 250, 500, 18, 75, 14],
            ['Cháo gà', '1 tô', 400, 300, 18, 40, 7],
            ['Gỏi cuốn', '1 cuốn', 60, 60, 4, 9, 1],
            ['Chả giò', '1 cuốn', 40, 110, 4, 8, 7],
            ['Mì gói', '1 gói', 75, 350, 7, 50, 14],
            ['Thịt kho trứng', '1 phần', 200, 400, 22, 6, 32],
            ['Cá kho tộ', '1 phần', 150, 250, 25, 8, 13],
            ['Bò lúc lắc', '1 phần', 200, 400, 30, 10, 26],
            ['Đậu hũ sốt cà chua', '1 phần', 200, 200, 14, 10, 12],
            ['Rau muống xào tỏi', '1 đĩa', 150, 120, 4, 6, 9],
            ['Canh chua cá', '1 tô', 300, 150, 15, 12, 4],
            ['Ức gà luộc', '100 g', 100, 165, 31, 0, 3.6],
            ['Thịt heo nạc luộc', '100 g', 100, 145, 21, 0, 6],
            ['Trứng gà luộc', '1 quả', 50, 72, 6.3, 0.4, 4.8],
            ['Trứng chiên', '1 quả', 60, 110, 7, 0.5, 9],
            ['Khoai lang luộc', '1 củ', 150, 130, 2.4, 30, 0.2],
            ['Yến mạch', '40 g', 40, 150, 5, 27, 3],
            ['Chuối', '1 quả', 120, 105, 1.3, 27, 0.4],
            ['Táo', '1 quả', 180, 95, 0.5, 25, 0.3],
            ['Đậu phộng', '30 g', 30, 170, 7, 5, 14],
            ['Sữa tươi không đường', '1 hộp 180 ml', 180, 120, 6, 8.5, 6.5],
            ['Sữa chua có đường', '1 hộp', 100, 100, 3.5, 15, 3],
            ['Whey protein', '1 muỗng', 30, 120, 24, 3, 1.5],
            ['Cà phê sữa đá', '1 ly', 200, 150, 2, 25, 4],
            ['Trà sữa trân châu', '1 ly 500 ml', 500, 450, 5, 75, 14],
            ['Nước mía', '1 ly', 300, 180, 0, 45, 0],
        ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('food_entries');
        Schema::dropIfExists('foods');
        Schema::dropIfExists('nutrition_profiles');
    }
};

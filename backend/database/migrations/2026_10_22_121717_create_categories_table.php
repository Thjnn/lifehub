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
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            // null = system default, visible to everyone and read-only.
            $table->foreignId('user_id')->nullable()->index()->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->string('type', 10);
            $table->string('icon', 50)->nullable(); // lucide icon name
            $table->string('color', 7)->nullable(); // #RRGGBB
            $table->timestampsTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense'))");
        }

        // Reference data lives in the migration (not a seeder) so production gets it: Render only runs `migrate`.
        $now = now();
        DB::table('categories')->insert(array_map(fn (array $c) => $c + ['user_id' => null, 'created_at' => $now, 'updated_at' => $now], [
            ['name' => 'Ăn uống', 'type' => 'expense', 'icon' => 'utensils', 'color' => '#F87171'],
            ['name' => 'Học tập', 'type' => 'expense', 'icon' => 'book-open', 'color' => '#5B8CFF'],
            ['name' => 'Nhà ở', 'type' => 'expense', 'icon' => 'house', 'color' => '#A78BFA'],
            ['name' => 'Đi lại', 'type' => 'expense', 'icon' => 'bus', 'color' => '#38BDF8'],
            ['name' => 'Gym', 'type' => 'expense', 'icon' => 'dumbbell', 'color' => '#34D399'],
            ['name' => 'Giải trí', 'type' => 'expense', 'icon' => 'gamepad-2', 'color' => '#FBBF24'],
            ['name' => 'Khác', 'type' => 'expense', 'icon' => 'ellipsis', 'color' => '#9CA3AF'],
            ['name' => 'Thu nhập', 'type' => 'income', 'icon' => 'wallet', 'color' => '#34D399'],
        ]));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};

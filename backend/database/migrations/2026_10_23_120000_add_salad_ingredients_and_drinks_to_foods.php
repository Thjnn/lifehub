<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Salad ingredients, fruit and drinks (rounded USDA / Vietnamese food table values).
     * A new migration, not an edit of the first one: that one already ran in production.
     * Same row shape: [name, serving, grams, kcal, protein, carbs, fat].
     */
    private const FOODS = [
        // Vegetables and salad bases
        ['Dưa leo', '100 g', 100, 15, 0.7, 3.6, 0.1],
        ['Cà chua', '1 quả', 120, 22, 1.1, 4.7, 0.2],
        ['Xà lách', '100 g', 100, 15, 1.4, 2.9, 0.2],
        ['Cà rốt', '100 g', 100, 41, 0.9, 9.6, 0.2],
        ['Bắp cải tím', '100 g', 100, 31, 1.4, 7.4, 0.2],
        ['Bắp cải luộc', '100 g', 100, 23, 1.3, 5.5, 0.1],
        ['Bông cải xanh luộc', '100 g', 100, 35, 2.4, 7.2, 0.4],
        ['Rau muống luộc', '100 g', 100, 20, 2.6, 3.1, 0.2],
        ['Đậu bắp luộc', '100 g', 100, 22, 1.9, 4.5, 0.2],
        ['Hành tây', '100 g', 100, 40, 1.1, 9.3, 0.1],
        ['Ớt chuông', '100 g', 100, 26, 1, 6, 0.3],
        ['Bắp ngọt luộc', '1 trái', 150, 144, 5.1, 31, 2.1],
        ['Khoai tây luộc', '1 củ', 150, 130, 2.9, 30, 0.2],
        ['Bơ', '100 g', 100, 160, 2, 8.5, 14.7],
        // Protein and dressings for a salad
        ['Đậu hũ', '100 g', 100, 76, 8, 1.9, 4.8],
        ['Cá ngừ hộp ngâm nước', '100 g', 100, 116, 26, 0, 0.8],
        ['Dầu ô liu', '1 muỗng canh', 14, 120, 0, 0, 14],
        ['Sốt mè rang', '1 muỗng canh', 15, 70, 0.5, 3, 6],
        ['Sốt mayonnaise', '1 muỗng canh', 14, 94, 0.1, 0.1, 10.3],
        ['Hạt chia', '1 muỗng canh', 12, 58, 2, 5, 3.7],
        ['Hạt điều', '30 g', 30, 165, 5.4, 9, 13],
        // Starches
        ['Cơm gạo lứt', '1 chén', 150, 165, 3.8, 34, 1.3],
        ['Bánh mì nguyên cám', '1 lát', 30, 75, 3.9, 12.6, 1],
        // Fruit
        ['Dưa hấu', '1 miếng', 200, 60, 1.2, 15, 0.3],
        ['Cam', '1 quả', 150, 70, 1.4, 17.6, 0.2],
        ['Ổi', '1 quả', 150, 102, 3.8, 21.5, 1.4],
        ['Thanh long', '1/2 quả', 200, 120, 2.4, 26, 0.8],
        ['Đu đủ', '1 miếng', 200, 86, 0.9, 21.6, 0.5],
        ['Xoài chín', '1/2 quả', 200, 120, 1.6, 30, 0.8],
        // Drinks
        ['Cà phê đen không đường', '1 ly 200 ml', 200, 4, 0.3, 0, 0],
        ['Cà phê đen có đường', '1 ly 200 ml', 200, 45, 0.3, 10, 0],
        ['Bạc xỉu', '1 ly', 200, 190, 4, 28, 6],
        ['Trà không đường', '1 ly 250 ml', 250, 2, 0, 0.5, 0],
        ['Nước dừa', '1 trái 300 ml', 300, 57, 2.2, 11, 0.6],
        ['Nước cam vắt', '1 ly 250 ml', 250, 112, 1.7, 26, 0.5],
        ['Sữa đậu nành có đường', '1 ly 250 ml', 250, 130, 7, 15, 4.5],
        ['Nước ngọt có ga', '1 lon 330 ml', 330, 140, 0, 35, 0],
        ['Bia', '1 lon 330 ml', 330, 145, 1.6, 12, 0],
    ];

    public function up(): void
    {
        $now = now();
        // insertOrIgnore: `name` is unique, so a re-run never duplicates or fails.
        DB::table('foods')->insertOrIgnore(array_map(fn (array $f) => [
            'name' => $f[0], 'serving' => $f[1], 'serving_grams' => $f[2], 'kcal' => $f[3],
            'protein_g' => $f[4], 'carbs_g' => $f[5], 'fat_g' => $f[6], 'created_at' => $now, 'updated_at' => $now,
        ], self::FOODS));
    }

    public function down(): void
    {
        // Logged entries keep their nutrition snapshot (food_id → null).
        DB::table('foods')->whereIn('name', array_column(self::FOODS, 0))->delete();
    }
};

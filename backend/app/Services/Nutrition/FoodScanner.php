<?php

namespace App\Services\Nutrition;

use App\Models\Food;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Gemini;
use Illuminate\Support\Collection;

/**
 * Food scan (spec §15.1): Gemini only recognises dishes and estimates grams. Dishes in the table get the table's
 * numbers; anything else keeps Gemini's estimate, flagged as such. Nothing is saved here — the user reviews the
 * result and logs it through the normal food-entry endpoint. The photo lives only in this request's memory.
 */
class FoodScanner
{
    private const MAX_ITEMS = 8;

    private const SCHEMA = ['type' => 'OBJECT', 'properties' => ['dish_name' => ['type' => 'STRING', 'description' => 'Short Vietnamese name for the whole plate, e.g. "Salad ức gà"'], 'items' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => [
        'name' => ['type' => 'STRING', 'description' => 'Vietnamese dish name'],
        'food_id' => ['type' => 'INTEGER', 'description' => 'id from the dish list, or 0 if not in it'],
        'grams' => ['type' => 'INTEGER', 'description' => 'estimated amount on the plate'],
        'kcal' => ['type' => 'NUMBER'],
        'protein_g' => ['type' => 'NUMBER'],
        'carbs_g' => ['type' => 'NUMBER'],
        'fat_g' => ['type' => 'NUMBER'],
        'confidence' => ['type' => 'NUMBER', 'description' => '0 to 1'],
    ], 'required' => ['name', 'food_id', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence']]]], 'required' => ['dish_name', 'items']];

    public function __construct(private Gemini $gemini) {}

    /**
     * The plate as one dish: a name for it plus its components (logged as a single entry).
     *
     * @return array{name: string, items: list<array<string, mixed>>}
     *
     * @throws AiUnavailable
     */
    public function scan(string $mimeType, string $base64): array
    {
        $foods = Food::all()->keyBy('id');
        $prompt = implode("\n", [
            'Đặt một tên ngắn cho cả đĩa/bữa trong ảnh (dish_name), rồi liệt kê từng thành phần (món, rau, sốt, đồ uống) với khối lượng (gram) ước lượng.',
            'Nếu món có trong danh sách, dùng đúng food_id đó; nếu không, food_id = 0 và tự ước tính kcal/protein/carbs/fat cho khối lượng đó.',
            'Ảnh không có đồ ăn thì trả về danh sách rỗng.',
            'Danh sách món (id|tên|khẩu phần chuẩn):',
            $foods->map(fn (Food $f) => "{$f->id}|{$f->name}|{$f->serving} ≈ {$f->serving_grams} g")->implode("\n"),
        ]);

        $result = $this->gemini->generate(
            'Bạn là chuyên gia dinh dưỡng, nhận diện món Việt từ ảnh và ước lượng khẩu phần thực tế.',
            [['role' => 'user', 'parts' => [['inlineData' => ['mimeType' => $mimeType, 'data' => $base64]], ['text' => $prompt]]]],
            schema: self::SCHEMA,
        );
        $json = json_decode(implode('', array_column(array_filter($result['parts'], fn ($p) => isset($p['text'])), 'text')), true);

        $items = collect(is_array($json['items'] ?? null) ? $json['items'] : [])
            ->map(fn ($row) => is_array($row) ? $this->item($row, $foods) : null)
            ->filter()
            ->take(self::MAX_ITEMS)
            ->values()
            ->all();
        $name = mb_substr(trim((string) ($json['dish_name'] ?? '')), 0, 100);

        // A single component names the plate itself; no name from the model → the first component's.
        return ['name' => count($items) === 1 ? $items[0]['name'] : ($name !== '' ? $name : ($items[0]['name'] ?? '')), 'items' => $items];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  Collection<int, Food>  $foods
     * @return array<string, mixed>|null
     */
    private function item(array $row, $foods): ?array
    {
        $grams = (int) ($row['grams'] ?? 0);
        if ($grams < 1 || $grams > 3000) {
            return null;
        }
        $confidence = round(max(0, min(1, (float) ($row['confidence'] ?? 0))), 2);

        if ($food = $foods->get((int) ($row['food_id'] ?? 0))) {
            return ['food_id' => $food->id, 'name' => $food->name, 'grams' => $grams, ...$food->scaled($grams), 'estimated' => false, 'confidence' => $confidence];
        }

        $name = mb_substr(trim((string) ($row['name'] ?? '')), 0, 100);
        if ($name === '') {
            return null;
        }
        // Same bounds as a manual food entry, so the user can log it as is.
        $number = fn (string $key, int $max) => round(max(0, min($max, (float) ($row[$key] ?? 0))), 1);

        return [
            'food_id' => null, 'name' => $name, 'grams' => $grams,
            'kcal' => $number('kcal', 10000), 'protein_g' => $number('protein_g', 1000), 'carbs_g' => $number('carbs_g', 1000), 'fat_g' => $number('fat_g', 1000),
            'estimated' => true, 'confidence' => $confidence,
        ];
    }
}

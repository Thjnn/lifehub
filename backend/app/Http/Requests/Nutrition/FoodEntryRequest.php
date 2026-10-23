<?php

namespace App\Http\Requests\Nutrition;

use App\Enums\Meal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Either a dish from `foods` + grams (nutrition computed on the server), or the user's own numbers.
 */
class FoodEntryRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $table = $this->filled('food_id');
        $plate = ! $table && $this->has('components'); // a scanned plate: one named dish made of components
        $manual = ! $table && ! $plate;

        return [
            'eaten_at' => ['required', 'date'],
            'meal' => ['required', Rule::enum(Meal::class)],
            'food_id' => ['nullable', 'integer', 'exists:foods,id'],
            'grams' => [$table ? 'required' : 'nullable', 'numeric', 'gt:0', 'max:5000'],
            'name' => [Rule::requiredIf(! $table), 'nullable', 'string', 'max:100'],
            'kcal' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,10000'],
            'protein_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
            'carbs_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
            'fat_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
            // Components from the table get the table's numbers on the server; others keep the (AI) estimate sent.
            'components' => ['sometimes', 'array', 'min:1', 'max:12'],
            'components.*.name' => ['required', 'string', 'max:100'],
            'components.*.food_id' => ['nullable', 'integer', 'exists:foods,id'],
            'components.*.grams' => ['required', 'numeric', 'gt:0', 'max:5000'],
            'components.*.kcal' => ['required', 'numeric', 'between:0,10000'],
            'components.*.protein_g' => ['required', 'numeric', 'between:0,1000'],
            'components.*.carbs_g' => ['required', 'numeric', 'between:0,1000'],
            'components.*.fat_g' => ['required', 'numeric', 'between:0,1000'],
        ];
    }
}

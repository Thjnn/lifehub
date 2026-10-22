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
        $manual = ! $this->filled('food_id');

        return [
            'eaten_at' => ['required', 'date'],
            'meal' => ['required', Rule::enum(Meal::class)],
            'food_id' => ['nullable', 'integer', 'exists:foods,id'],
            'grams' => [$manual ? 'nullable' : 'required', 'numeric', 'gt:0', 'max:5000'],
            'name' => [Rule::requiredIf($manual), 'nullable', 'string', 'max:100'],
            'kcal' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,10000'],
            'protein_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
            'carbs_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
            'fat_g' => [Rule::requiredIf($manual), 'nullable', 'numeric', 'between:0,1000'],
        ];
    }
}

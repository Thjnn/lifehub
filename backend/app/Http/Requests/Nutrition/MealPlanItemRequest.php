<?php

namespace App\Http\Requests\Nutrition;

use App\Enums\Meal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A dish the user adds to / changes in their plan. Only dishes from the table, so "Đã ăn" can use the table's numbers.
 */
class MealPlanItemRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'meal' => ['required', Rule::enum(Meal::class)],
            'food_id' => ['required', 'integer', 'exists:foods,id'],
            'grams' => ['required', 'integer', 'between:10,1500'],
        ];
    }
}

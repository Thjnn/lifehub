<?php

namespace App\Http\Resources;

use App\Models\MealPlanItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin MealPlanItem */
class MealPlanItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'meal' => $this->meal,
            'food_id' => $this->food_id,
            'name' => $this->food->name,
            'grams' => $this->grams,
            ...$this->food->scaled($this->grams),
            'est_cost' => $this->est_cost,
            'food_entry_id' => $this->food_entry_id, // set = eaten
        ];
    }
}

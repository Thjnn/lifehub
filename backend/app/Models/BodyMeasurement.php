<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['measured_on', 'weight_kg', 'waist_cm', 'body_fat_pct'])]
class BodyMeasurement extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['measured_on' => 'date:Y-m-d', 'weight_kg' => 'float', 'waist_cm' => 'float', 'body_fat_pct' => 'float'];
    }
}

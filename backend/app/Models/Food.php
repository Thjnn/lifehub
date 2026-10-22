<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Read-only reference dishes, inserted by the nutrition migration. */
class Food extends Model
{
    protected $table = 'foods';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['kcal' => 'float', 'protein_g' => 'float', 'carbs_g' => 'float', 'fat_g' => 'float'];
    }
}

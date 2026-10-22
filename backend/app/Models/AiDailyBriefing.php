<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['briefing_date', 'content'])]
class AiDailyBriefing extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['briefing_date' => 'date:Y-m-d'];
    }
}

<?php

namespace App\Models;

use App\Casts\UtcDateTime;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Something the AI suggested doing (create a task / event). Nothing is written until the user confirms (spec §9.5).
 */
#[Fillable(['conversation_id', 'action_type', 'payload', 'status', 'expires_at', 'confirmed_at'])]
class AiActionProposal extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'expires_at' => UtcDateTime::class,
            'confirmed_at' => UtcDateTime::class,
        ];
    }
}

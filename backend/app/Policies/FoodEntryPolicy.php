<?php

namespace App\Policies;

use App\Models\FoodEntry;
use App\Models\User;

class FoodEntryPolicy
{
    public function delete(User $user, FoodEntry $entry): bool
    {
        return $entry->user_id === $user->id;
    }
}

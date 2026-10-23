<?php

namespace App\Policies;

use App\Models\MealPlanItem;
use App\Models\User;

class MealPlanItemPolicy
{
    public function update(User $user, MealPlanItem $item): bool
    {
        return $item->user_id === $user->id;
    }

    public function delete(User $user, MealPlanItem $item): bool
    {
        return $item->user_id === $user->id;
    }
}

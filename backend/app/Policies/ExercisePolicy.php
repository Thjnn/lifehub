<?php

namespace App\Policies;

use App\Models\Exercise;
use App\Models\User;

// System exercises (user_id null) are shared and read-only.
class ExercisePolicy
{
    public function delete(User $user, Exercise $exercise): bool
    {
        return $exercise->user_id === $user->id;
    }
}

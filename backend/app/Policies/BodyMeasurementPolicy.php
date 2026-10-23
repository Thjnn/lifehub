<?php

namespace App\Policies;

use App\Models\BodyMeasurement;
use App\Models\User;

class BodyMeasurementPolicy
{
    public function delete(User $user, BodyMeasurement $bodyMeasurement): bool
    {
        return $bodyMeasurement->user_id === $user->id;
    }
}

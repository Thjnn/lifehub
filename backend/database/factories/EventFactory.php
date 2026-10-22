<?php

namespace Database\Factories;

use App\Enums\EventStatus;
use App\Enums\EventType;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = now()->addDay()->startOfHour();

        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(3),
            'description' => null,
            'start_at' => $start,
            'end_at' => $start->copy()->addHour(),
            'event_type' => EventType::Work,
            'status' => EventStatus::Scheduled,
            'recurrence_rule' => null,
        ];
    }
}

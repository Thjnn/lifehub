<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /**
     * Statuses that still need work — the ones "overdue" applies to.
     *
     * @return list<self>
     */
    public static function open(): array
    {
        return [self::Todo, self::InProgress];
    }
}

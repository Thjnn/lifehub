<?php

namespace App\Enums;

enum EventType: string
{
    case Study = 'study';
    case Work = 'work';
    case Workout = 'workout';
    case Rest = 'rest';
    case Personal = 'personal';
}

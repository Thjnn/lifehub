<?php

namespace App\Enums;

enum NutritionGoal: string
{
    case Cut = 'cut'; // giảm mỡ
    case Maintain = 'maintain'; // giữ cân
    case Bulk = 'bulk'; // tăng cơ
}

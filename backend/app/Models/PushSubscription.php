<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['endpoint', 'public_key', 'auth_token', 'user_agent'])]
class PushSubscription extends Model {}

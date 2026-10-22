<?php

namespace App\Services\Ai;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Provider timeout, quota, misconfiguration… — shown to the user as a friendly 503, never a crash (spec §9.5).
 */
class AiUnavailable extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 503);
    }
}

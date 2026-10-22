<?php

namespace App\Services\Ai;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Provider timeout, quota, misconfiguration… — shown to the user as a friendly 503, never a crash (spec §9.5).
 * Not reported as an error: Gemini::generate already logs a warning with the provider's reason.
 */
class AiUnavailable extends RuntimeException implements ShouldntReport
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 503);
    }
}

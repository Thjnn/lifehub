<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Weather\OpenMeteo;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
    public function __construct(private OpenMeteo $weather) {}

    // GET /weather — forecast for the city chosen in Settings; data is null when none is set or the provider is down.
    public function show(Request $request): JsonResponse
    {
        $settings = $request->user()->settings;
        if ($settings?->latitude === null || $settings->longitude === null) {
            return response()->json(['data' => null]);
        }

        $forecast = $this->weather->forecast($settings->latitude, $settings->longitude, $settings->timezone);

        return response()->json(['data' => $forecast === null ? null : ['city' => $settings->city_name, ...$forecast]]);
    }

    // GET /weather/cities?q= — city search for the Settings picker.
    public function cities(Request $request): JsonResponse
    {
        $query = $request->validate(['q' => ['required', 'string', 'min:2', 'max:80']])['q'];

        try {
            return response()->json(['data' => $this->weather->searchCities($query)]);
        } catch (ConnectionException|RequestException) {
            abort(503, 'Không tìm được thành phố lúc này, thử lại sau.');
        }
    }
}

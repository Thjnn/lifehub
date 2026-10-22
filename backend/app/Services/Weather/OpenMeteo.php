<?php

namespace App\Services\Weather;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Open-Meteo (spec §15.5): free, no API key, non-commercial use, limited per IP and day.
 *
 * The dashboard and city search call Open-Meteo from the browser (frontend features/dashboard/open-meteo.ts):
 * from here every user shares Render's IP, whose daily quota other apps exhaust (HTTP 429). This client only
 * feeds the AI Coach — best effort, cached an hour, and the AI simply goes without weather when it fails.
 */
class OpenMeteo
{
    private const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

    /**
     * Current conditions, the next hours and three days, in the user's timezone. Null if the provider is down.
     *
     * @return array<string, mixed>|null
     */
    public function forecast(float $latitude, float $longitude, string $timezone): ?array
    {
        // ~1 km grid is plenty for a city forecast and lets nearby users share the cache entry.
        $key = sprintf('weather:%.2f:%.2f:%s', $latitude, $longitude, $timezone);

        try {
            return Cache::remember($key, now()->addHour(), fn () => $this->fetch($latitude, $longitude, $timezone));
        } catch (Throwable $e) {
            // Not cached, so the next request retries. Logged (stderr on Render) — a silent null hid problems before.
            Log::warning('Open-Meteo forecast failed', [
                'error' => $e instanceof RequestException ? 'HTTP '.$e->response->status().': '.mb_substr($e->response->body(), 0, 300) : $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function fetch(float $latitude, float $longitude, string $timezone): array
    {
        $data = Http::timeout(8)->get(self::FORECAST_URL, [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'timezone' => $timezone,
            'forecast_days' => 3,
            'current' => 'temperature_2m,apparent_temperature,weather_code,precipitation',
            'hourly' => 'temperature_2m,precipitation_probability,weather_code',
            'daily' => 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        ])->throw()->json();

        // Next 12 hours from now (hourly series starts at local midnight today).
        $now = now($timezone)->format('Y-m-d\TH:00');
        $start = max(0, (int) array_search($now, $data['hourly']['time'], true));

        return [
            'current' => [
                'temperature' => $data['current']['temperature_2m'],
                'feels_like' => $data['current']['apparent_temperature'],
                'weather_code' => $data['current']['weather_code'],
                'precipitation' => $data['current']['precipitation'],
            ],
            'hourly' => collect(range($start, min($start + 11, count($data['hourly']['time']) - 1)))->map(fn (int $i) => [
                'time' => $data['hourly']['time'][$i],
                'temperature' => $data['hourly']['temperature_2m'][$i],
                'precipitation_probability' => $data['hourly']['precipitation_probability'][$i],
                'weather_code' => $data['hourly']['weather_code'][$i],
            ])->all(),
            'daily' => collect($data['daily']['time'])->map(fn (string $date, int $i) => [
                'date' => $date,
                'weather_code' => $data['daily']['weather_code'][$i],
                'max' => $data['daily']['temperature_2m_max'][$i],
                'min' => $data['daily']['temperature_2m_min'][$i],
                'precipitation_probability' => $data['daily']['precipitation_probability_max'][$i],
            ])->all(),
        ];
    }
}

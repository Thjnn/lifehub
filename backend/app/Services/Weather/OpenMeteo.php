<?php

namespace App\Services\Weather;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Open-Meteo (spec §15.5): free, no API key, non-commercial use. Called from the backend only and cached,
 * so the app makes at most one forecast request per place per hour.
 */
class OpenMeteo
{
    private const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

    private const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

    /**
     * @return list<array{name: string, region: string|null, country: string|null, latitude: float, longitude: float}>
     */
    public function searchCities(string $query): array
    {
        $results = Http::timeout(8)->get(self::GEOCODING_URL, [
            'name' => $query,
            'count' => 6,
            'language' => 'vi',
            'format' => 'json',
        ])->throw()->json('results') ?? [];

        return array_map(fn (array $r) => [
            'name' => $r['name'],
            'region' => $r['admin1'] ?? null,
            'country' => $r['country'] ?? null,
            'latitude' => (float) $r['latitude'],
            'longitude' => (float) $r['longitude'],
        ], $results);
    }

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
        } catch (ConnectionException|RequestException) {
            return null; // don't cache failures; the dashboard just hides the weather card
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

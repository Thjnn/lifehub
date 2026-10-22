<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

/**
 * PATCH /me/settings (spec §11): timezone, locale, theme, and the weather city (spec §15.5).
 */
class SettingsController extends Controller
{
    public function update(Request $request): UserResource
    {
        $data = $request->validate([
            'timezone' => ['sometimes', 'timezone:all'],
            'locale' => ['sometimes', 'in:vi,en'],
            'theme' => ['sometimes', 'in:dark,light,system'],
            // City from GET /weather/cities; null clears it. Name and coordinates travel together.
            'city' => ['sometimes', 'nullable', 'array'],
            'city.name' => ['required_with:city', 'string', 'max:120'],
            'city.latitude' => ['required_with:city', 'numeric', 'between:-90,90'],
            'city.longitude' => ['required_with:city', 'numeric', 'between:-180,180'],
        ]);

        $settings = $request->user()->settings;
        $settings->fill(collect($data)->except('city')->all());
        if (array_key_exists('city', $data)) {
            $settings->fill([
                'city_name' => $data['city']['name'] ?? null,
                'latitude' => $data['city']['latitude'] ?? null,
                'longitude' => $data['city']['longitude'] ?? null,
            ]);
        }
        $settings->save();

        return new UserResource($request->user()->load('settings'));
    }
}

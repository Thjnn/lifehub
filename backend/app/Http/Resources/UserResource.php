<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'settings' => $this->whenLoaded('settings', fn () => [
                'timezone' => $this->settings->timezone,
                'locale' => $this->settings->locale,
                'currency' => $this->settings->currency,
                'theme' => $this->settings->theme,
                'preferences' => $this->settings->preferences ?? (object) [],
            ]),
        ];
    }
}

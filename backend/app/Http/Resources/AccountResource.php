<?php

namespace App\Http\Resources;

use App\Models\Account;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Account */
class AccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'account_type' => $this->account_type,
            'currency' => $this->currency,
            'opening_balance' => Money::format($this->opening_balance),
            // Present when loaded via Account::withBalance()
            'balance' => $this->when(isset($this->balance), fn () => Money::format($this->balance)),
            'is_active' => $this->is_active,
        ];
    }
}

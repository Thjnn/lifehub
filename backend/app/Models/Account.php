<?php

namespace App\Models;

use App\Enums\AccountType;
use Database\Factories\AccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'account_type', 'opening_balance', 'is_active', 'due_date', 'due_day', 'installment_amount', 'credit_limit'])]
class Account extends Model
{
    /** @use HasFactory<AccountFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'account_type' => AccountType::class,
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
            'due_date' => 'date:Y-m-d',
            'due_day' => 'integer',
            'installment_amount' => 'decimal:2',
            'credit_limit' => 'decimal:2',
        ];
    }

    /**
     * Adds `balance` = opening + income − expense − transfer out + transfer in, as one SQL aggregate (spec §9.4).
     * Soft-deleted transactions don't count.
     */
    public function scopeWithBalance(Builder $query): void
    {
        $query->select('accounts.*')->selectRaw(<<<'SQL'
            accounts.opening_balance + coalesce((
                select sum(case
                    when t.account_id = accounts.id and t.type = 'income' then t.amount
                    when t.account_id = accounts.id then -t.amount
                    else t.amount
                end)
                from transactions t
                where t.deleted_at is null
                  and (t.account_id = accounts.id or t.to_account_id = accounts.id)
            ), 0) as balance
            SQL);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

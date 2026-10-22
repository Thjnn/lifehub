<?php

namespace App\Enums;

enum AccountType: string
{
    case Cash = 'cash';
    case Bank = 'bank';
    case Ewallet = 'ewallet';
    // I owe: SPayLater, credit card, money borrowed from a friend. Balance goes negative.
    case Liability = 'liability';
    // Owed to me: money I lent. Balance is positive until repaid.
    case Receivable = 'receivable';

    public function isDebt(): bool
    {
        return $this === self::Liability || $this === self::Receivable;
    }
}

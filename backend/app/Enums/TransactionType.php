<?php

namespace App\Enums;

enum TransactionType: string
{
    case Income = 'income';
    case Expense = 'expense';
    // One row moving money between two of the user's accounts; never counted as income or spending (spec §9.4).
    case Transfer = 'transfer';
}

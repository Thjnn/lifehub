<?php

use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\BudgetController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DebtController;
use App\Http\Controllers\Api\V1\EventController;
use App\Http\Controllers\Api\V1\FinanceReportController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\TransactionController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Render health check + keepalive. Touching the DB also keeps the Supabase project from pausing.
Route::get('/health', function () {
    try {
        DB::select('select 1');
    } catch (Throwable) {
        return response()->json(['status' => 'error', 'database' => 'down'], 503);
    }

    return response()->json(['status' => 'ok']);
});

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->middleware('throttle:6,1')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
        Route::post('/reset-password', [PasswordResetController::class, 'reset']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', fn (Request $request) => new UserResource($request->user()->load('settings')));

        // whereUuid: a malformed id is a 404, not a Postgres "invalid input syntax for type uuid" 500.
        Route::get('/tasks', [TaskController::class, 'index']);
        Route::put('/tasks/{id}', [TaskController::class, 'upsert'])->whereUuid('id');
        Route::post('/tasks/{task}/complete', [TaskController::class, 'complete'])->whereUuid('task');
        Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->whereUuid('task');

        Route::get('/events', [EventController::class, 'index']);
        Route::post('/events', [EventController::class, 'store']);
        Route::patch('/events/{event}', [EventController::class, 'update'])->whereNumber('event');
        Route::delete('/events/{event}', [EventController::class, 'destroy'])->whereNumber('event');

        Route::get('/accounts', [AccountController::class, 'index']);
        Route::post('/accounts', [AccountController::class, 'store']);
        Route::patch('/accounts/{account}', [AccountController::class, 'update'])->whereNumber('account');
        Route::delete('/accounts/{account}', [AccountController::class, 'destroy'])->whereNumber('account');

        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::patch('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->whereNumber('category');

        Route::get('/transactions', [TransactionController::class, 'index']);
        Route::put('/transactions/{id}', [TransactionController::class, 'upsert'])->whereUuid('id');
        Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy'])->whereUuid('transaction');

        Route::get('/budgets', [BudgetController::class, 'index']);
        Route::post('/budgets', [BudgetController::class, 'store']);
        Route::patch('/budgets/{budget}', [BudgetController::class, 'update'])->whereNumber('budget');
        Route::delete('/budgets/{budget}', [BudgetController::class, 'destroy'])->whereNumber('budget');

        Route::get('/reports/finance', FinanceReportController::class);
        Route::get('/debts/due', [DebtController::class, 'due']);
    });
});

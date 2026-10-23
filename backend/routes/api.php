<?php

use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\AiController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\BudgetController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DebtController;
use App\Http\Controllers\Api\V1\EventController;
use App\Http\Controllers\Api\V1\FinanceReportController;
use App\Http\Controllers\Api\V1\FitnessController;
use App\Http\Controllers\Api\V1\MealPlanController;
use App\Http\Controllers\Api\V1\NoteController;
use App\Http\Controllers\Api\V1\NutritionController;
use App\Http\Controllers\Api\V1\PrivacyController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PushController;
use App\Http\Controllers\Api\V1\SettingsController;
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

// Deadline reminders (spec §15.2): GitHub Actions cron, shared-secret header (Render has no scheduler).
Route::post('/internal/reminders', [PushController::class, 'reminders'])->middleware('throttle:10,1');

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
        Route::patch('/me/settings', [SettingsController::class, 'update']);
        Route::patch('/me', [ProfileController::class, 'update']);
        Route::put('/me/password', [ProfileController::class, 'password'])->middleware('throttle:6,1');
        Route::delete('/me', [PrivacyController::class, 'destroy'])->middleware('throttle:6,1');
        Route::get('/privacy/export', [PrivacyController::class, 'export'])->middleware('throttle:6,1');

        Route::get('/dashboard', DashboardController::class);

        // AI Coach — online only, per-user daily limits inside the controller
        Route::get('/ai/briefing', [AiController::class, 'briefing']);
        Route::post('/ai/briefing/refresh', [AiController::class, 'refreshBriefing']);
        Route::post('/ai/chat', [AiController::class, 'chat']);
        Route::get('/ai/conversations/latest', [AiController::class, 'latest']);
        Route::post('/ai/meal-plan', [AiController::class, 'mealPlan']);
        Route::post('/ai/food-scan', [AiController::class, 'foodScan']);
        Route::post('/ai/proposals/{proposal}/confirm', [AiController::class, 'confirm'])->whereNumber('proposal');
        Route::post('/ai/proposals/{proposal}/reject', [AiController::class, 'reject'])->whereNumber('proposal');

        // whereUuid: a malformed id is a 404, not a Postgres "invalid input syntax for type uuid" 500.
        Route::get('/tasks', [TaskController::class, 'index']);
        Route::put('/tasks/{id}', [TaskController::class, 'upsert'])->whereUuid('id');
        Route::post('/tasks/{task}/complete', [TaskController::class, 'complete'])->whereUuid('task');
        Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->whereUuid('task');

        Route::get('/nutrition/profile', [NutritionController::class, 'profile']);
        Route::put('/nutrition/profile', [NutritionController::class, 'updateProfile']);
        Route::get('/foods', [NutritionController::class, 'foods']);
        Route::get('/food-entries', [NutritionController::class, 'entries']);
        Route::post('/food-entries', [NutritionController::class, 'storeEntry']);
        Route::post('/food-entries/copy', [NutritionController::class, 'copyDay']);
        Route::delete('/food-entries/{entry}', [NutritionController::class, 'destroyEntry'])->whereNumber('entry');
        Route::get('/exercises', [FitnessController::class, 'exercises']);
        Route::post('/exercises', [FitnessController::class, 'storeExercise']);
        Route::delete('/exercises/{exercise}', [FitnessController::class, 'destroyExercise'])->whereNumber('exercise');
        Route::get('/workouts', [FitnessController::class, 'workouts']);
        Route::post('/workouts', [FitnessController::class, 'storeWorkout']);
        Route::put('/workouts/{workout}', [FitnessController::class, 'updateWorkout'])->whereNumber('workout');
        Route::delete('/workouts/{workout}', [FitnessController::class, 'destroyWorkout'])->whereNumber('workout');
        Route::get('/body-measurements', [FitnessController::class, 'measurements']);
        Route::put('/body-measurements/{date}', [FitnessController::class, 'upsertMeasurement'])->where('date', '\d{4}-\d{2}-\d{2}');
        Route::delete('/body-measurements/{measurement}', [FitnessController::class, 'destroyMeasurement'])->whereNumber('measurement');
        Route::get('/meal-plan', [MealPlanController::class, 'index']);
        Route::post('/meal-plan-items', [MealPlanController::class, 'store']);
        Route::put('/meal-plan-items/{item}', [MealPlanController::class, 'update'])->whereNumber('item');
        Route::post('/meal-plan-items/{item}/eat', [MealPlanController::class, 'eat'])->whereNumber('item');
        Route::delete('/meal-plan-items/{item}', [MealPlanController::class, 'destroy'])->whereNumber('item');

        Route::get('/push/key', [PushController::class, 'key']);
        Route::post('/push/subscriptions', [PushController::class, 'subscribe']);
        Route::delete('/push/subscriptions', [PushController::class, 'unsubscribe']);

        Route::get('/notes', [NoteController::class, 'index']);
        Route::put('/notes/{id}', [NoteController::class, 'upsert'])->whereUuid('id');
        Route::delete('/notes/{note}', [NoteController::class, 'destroy'])->whereUuid('note');

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

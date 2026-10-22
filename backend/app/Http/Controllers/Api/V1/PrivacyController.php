<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Spec §8 Privacy: GET /privacy/export (all of the user's data as JSON) and DELETE /me.
 */
class PrivacyController extends Controller
{
    /** Tables holding a user_id column, exported as-is. */
    private const TABLES = ['user_settings', 'tasks', 'events', 'notes', 'nutrition_profiles', 'food_entries', 'accounts', 'categories', 'transactions', 'budgets', 'ai_conversations', 'ai_action_proposals', 'ai_daily_briefings'];

    public function export(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = [
            'exported_at' => now()->toIso8601String(),
            'user' => $user->only(['id', 'name', 'email', 'avatar', 'created_at']),
        ];
        foreach (self::TABLES as $table) {
            $data[$table] = DB::table($table)->where('user_id', $user->id)->get();
        }
        $data['ai_messages'] = DB::table('ai_messages')
            ->whereIn('conversation_id', DB::table('ai_conversations')->where('user_id', $user->id)->select('id'))
            ->get();

        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="lifehub-export-'.now()->format('Y-m-d').'.json"',
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    public function destroy(Request $request): Response
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $request->user()->purge();

        return response()->noContent();
    }
}

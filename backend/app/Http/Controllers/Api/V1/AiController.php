<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EventStatus;
use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Models\AiActionProposal;
use App\Models\AiConversation;
use App\Services\Ai\Coach;
use App\Services\Nutrition\MealPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * AI Coach endpoints (spec §9.5, §11). Online only; per-user daily limits keep us inside the free Gemini quota.
 */
class AiController extends Controller
{
    private const CHAT_PER_DAY = 30;

    private const REFRESH_PER_DAY = 3;

    private const MEAL_PLAN_PER_DAY = 3;

    public function __construct(private Coach $coach, private MealPlanner $planner) {}

    // POST /ai/meal-plan {week_start} — a week of meals as a proposal; nothing is saved until confirmed
    public function mealPlan(Request $request): JsonResponse
    {
        $week = $request->validate(['week_start' => ['required', 'date_format:Y-m-d']])['week_start'];
        $this->limit("ai-meal-plan:{$request->user()->id}", self::MEAL_PLAN_PER_DAY, 'Bạn đã tạo thực đơn '.self::MEAL_PLAN_PER_DAY.' lần trong 24 giờ. Hẹn bạn ngày mai nhé!');

        return response()->json(['data' => $this->presentProposal($this->planner->propose($request->user(), Carbon::parse($week)->startOfWeek(Carbon::MONDAY)))]);
    }

    // GET /ai/briefing — today's briefing, generated on the first request of the day
    public function briefing(Request $request): JsonResponse
    {
        return $this->presentBriefing($this->coach->briefing($request->user()));
    }

    // POST /ai/briefing/refresh
    public function refreshBriefing(Request $request): JsonResponse
    {
        $this->limit("ai-refresh:{$request->user()->id}", self::REFRESH_PER_DAY, 'Bạn đã làm mới bản tóm tắt '.self::REFRESH_PER_DAY.' lần trong 24 giờ.');

        return $this->presentBriefing($this->coach->briefing($request->user(), refresh: true));
    }

    // POST /ai/chat {message, conversation_id?}
    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'conversation_id' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $this->limit("ai-chat:{$user->id}", self::CHAT_PER_DAY, 'Bạn đã dùng hết '.self::CHAT_PER_DAY.' câu hỏi trong 24 giờ. Hẹn bạn ngày mai nhé!');

        $conversation = isset($data['conversation_id'])
            ? AiConversation::where('user_id', $user->id)->findOrFail($data['conversation_id'])
            : $this->newConversation($user->id, $data['message']);

        $reply = $this->coach->chat($user, $conversation, $data['message']);

        return response()->json(['data' => [
            'conversation_id' => $conversation->id,
            'reply' => $reply['content'],
            'proposals' => AiActionProposal::whereIn('id', $reply['proposal_ids'])->get()->map($this->presentProposal(...)),
            'remaining_today' => RateLimiter::remaining("ai-chat:{$user->id}", self::CHAT_PER_DAY),
        ]]);
    }

    // GET /ai/conversations/latest — reopen the last chat with its pending proposals
    public function latest(Request $request): JsonResponse
    {
        $conversation = AiConversation::where('user_id', $request->user()->id)->latest('id')->first();
        if (! $conversation) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => [
            'conversation_id' => $conversation->id,
            'messages' => $conversation->messages()->orderBy('id')->get(['id', 'role', 'content', 'created_at']),
            'proposals' => AiActionProposal::where('conversation_id', $conversation->id)->where('status', 'pending')
                ->where('expires_at', '>', now())->get()->map($this->presentProposal(...)),
        ]]);
    }

    // POST /ai/proposals/{proposal}/confirm — the only path by which AI suggestions become data
    public function confirm(Request $request, AiActionProposal $proposal): JsonResponse
    {
        $this->authorizeProposal($request, $proposal);

        $created = DB::transaction(function () use ($request, $proposal) {
            $p = $proposal->payload;
            $result = match ($proposal->action_type) {
                'create_task' => (function () use ($request, $p) {
                    $task = $request->user()->tasks()->make([
                        'title' => $p['title'],
                        'description' => $p['description'] ?? null,
                        'priority' => $p['priority'],
                        'status' => TaskStatus::Todo,
                        'due_at' => $p['due_at'] ?? null,
                    ]);
                    $task->id = (string) Str::uuid();
                    $task->save();

                    return ['type' => 'task', 'id' => $task->id];
                })(),
                'create_event' => ['type' => 'event', 'id' => $request->user()->events()->create([
                    'title' => $p['title'],
                    'start_at' => $p['start_at'],
                    'end_at' => $p['end_at'],
                    'event_type' => $p['event_type'],
                    'location' => $p['location'] ?? null,
                    'status' => EventStatus::Scheduled,
                ])->id],
                'create_meal_plan' => $this->planner->apply($request->user(), $p),
                default => abort(422, 'Loại đề xuất không hỗ trợ.'),
            };
            $proposal->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $result;
        });

        return response()->json(['data' => ['proposal' => $this->presentProposal($proposal->fresh()), 'created' => $created]]);
    }

    // POST /ai/proposals/{proposal}/reject
    public function reject(Request $request, AiActionProposal $proposal): JsonResponse
    {
        $this->authorizeProposal($request, $proposal);
        $proposal->update(['status' => 'rejected']);

        return response()->json(['data' => $this->presentProposal($proposal)]);
    }

    private function authorizeProposal(Request $request, AiActionProposal $proposal): void
    {
        abort_if($proposal->user_id !== $request->user()->id, 403);
        if ($proposal->status === 'pending' && $proposal->expires_at->isPast()) {
            $proposal->update(['status' => 'expired']);
        }
        abort_if($proposal->status !== 'pending', 409, 'Đề xuất này đã được xử lý hoặc hết hạn.');
    }

    private function limit(string $key, int $max, string $message): void
    {
        abort_if(RateLimiter::tooManyAttempts($key, $max), 429, $message);
        RateLimiter::hit($key, 24 * 60 * 60);
    }

    private function newConversation(int $userId, string $firstMessage): AiConversation
    {
        $conversation = new AiConversation(['title' => Str::limit($firstMessage, 60)]);
        $conversation->user_id = $userId;
        $conversation->save();

        return $conversation;
    }

    private function presentBriefing($briefing): JsonResponse
    {
        return response()->json(['data' => [
            'date' => $briefing->briefing_date->toDateString(),
            'content' => $briefing->content,
            'generated_at' => $briefing->updated_at?->toIso8601String(),
        ]]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentProposal(AiActionProposal $p): array
    {
        return [
            'id' => $p->id,
            'action_type' => $p->action_type,
            'payload' => $p->payload,
            'status' => $p->status,
            'expires_at' => $p->expires_at->toIso8601String(),
        ];
    }
}

<?php

namespace Tests\Feature\Api\V1;

use App\Models\Account;
use App\Models\AiActionProposal;
use App\Models\Category;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test', 'services.gemini.fallback_model' => 'gemini-lite-test']);
        Sleep::fake(); // retry back-off without actually waiting
        $this->travelTo('2026-10-22 03:00:00'); // Thursday 10:00 in Vietnam
        $this->user = User::factory()->create(['name' => 'Nguyễn Minh']);
    }

    private static function text(string $text): array
    {
        return ['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => $text]]]]], 'usageMetadata' => ['totalTokenCount' => 42]];
    }

    private static function functionCall(string $name, array $args = []): array
    {
        return ['candidates' => [['content' => ['role' => 'model', 'parts' => [['functionCall' => ['name' => $name, 'args' => $args]]]]]]];
    }

    public function test_chat_answers_from_function_results_scoped_to_the_user(): void
    {
        $cash = Account::factory()->for($this->user)->create();
        $food = Category::whereNull('user_id')->where('name', 'Ăn uống')->value('id');
        foreach (['45000', '30000'] as $amount) {
            $this->actingAs($this->user)->putJson('/api/v1/transactions/'.Str::uuid(), [
                'type' => 'expense', 'account_id' => $cash->id, 'category_id' => $food, 'amount' => $amount,
                'occurred_at' => '2026-10-21T12:00:00+07:00', 'description' => null,
            ])->assertCreated();
        }
        // Someone else's spending must never reach the model
        $other = Account::factory()->create();
        $this->actingAs(User::find($other->user_id))->putJson('/api/v1/transactions/'.Str::uuid(), [
            'type' => 'expense', 'account_id' => $other->id, 'category_id' => $food, 'amount' => '999999',
            'occurred_at' => '2026-10-21T12:00:00+07:00', 'description' => null,
        ]);

        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(self::functionCall('get_spending', ['date_from' => '2026-10-19', 'date_to' => '2026-10-25', 'category' => 'ăn uống']))
            ->push(self::text('Tuần này bạn tiêu 75.000 ₫ cho ăn uống.'))]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Tuần này tôi tiêu bao nhiêu tiền ăn?'])
            ->assertOk()
            ->assertJsonPath('data.reply', 'Tuần này bạn tiêu 75.000 ₫ cho ăn uống.')
            ->assertJsonPath('data.remaining_today', 29);

        // Second request carried the function result back to Gemini — only this user's 75,000
        Http::assertSent(function (HttpRequest $request) {
            $response = data_get($request->data(), 'contents.2.parts.0.functionResponse.response');

            return $response !== null
                && $response['expense_vnd'] === '75000.00'
                && $response['expense_by_category'][0]['category'] === 'Ăn uống'
                && $request->hasHeader('x-goog-api-key', 'test-key');
        });
        $this->assertDatabaseCount('ai_messages', 2);
    }

    public function test_free_time_skips_events(): void
    {
        Event::factory()->for($this->user)->create(['start_at' => '2026-10-22T09:00:00+07:00', 'end_at' => '2026-10-22T11:30:00+07:00']);
        Event::factory()->for($this->user)->create(['start_at' => '2026-10-22T14:00:00+07:00', 'end_at' => '2026-10-22T15:00:00+07:00']);

        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(self::functionCall('get_free_time', ['date' => '2026-10-22']))
            ->push(self::text('ok'))]);
        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Chiều nay tôi rảnh lúc nào?'])->assertOk();

        Http::assertSent(fn (HttpRequest $r) => data_get($r->data(), 'contents.2.parts.0.functionResponse.response.free_slots') === [
            ['from' => '07:00', 'to' => '09:00'],
            ['from' => '11:30', 'to' => '14:00'],
            ['from' => '15:00', 'to' => '22:00'],
        ]);
    }

    public function test_ai_only_proposes_and_nothing_is_written_until_confirmed(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(self::functionCall('propose_task', ['title' => 'Ôn thi Toán', 'due_at' => '2026-10-24T20:00', 'priority' => 'high']))
            ->push(self::text('Mình đã đề xuất, bạn bấm Xác nhận nhé.'))]);

        $proposal = $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Nhắc tôi ôn thi Toán tối thứ Bảy'])
            ->assertOk()
            ->assertJsonPath('data.proposals.0.action_type', 'create_task')
            ->assertJsonPath('data.proposals.0.payload.due_at', '2026-10-24T13:00:00+00:00') // 20:00 Vietnam → UTC
            ->json('data.proposals.0.id');

        $this->assertDatabaseCount('tasks', 0);

        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal}/confirm")
            ->assertOk()
            ->assertJsonPath('data.created.type', 'task');
        $this->assertDatabaseHas('tasks', ['title' => 'Ôn thi Toán', 'user_id' => $this->user->id]);

        // Already handled → can't confirm twice
        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal}/confirm")->assertConflict();
    }

    public function test_proposals_are_private_and_expire(): void
    {
        $proposal = new AiActionProposal(['action_type' => 'create_task', 'payload' => ['title' => 'x', 'priority' => 'low'], 'status' => 'pending', 'expires_at' => now()->addDay()]);
        $proposal->user_id = User::factory()->create()->id;
        $proposal->save();

        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal->id}/confirm")->assertForbidden();

        $proposal->user_id = $this->user->id; // not mass-assignable
        $proposal->save();
        $this->travel(2)->days();
        $this->actingAs($this->user)->postJson("/api/v1/ai/proposals/{$proposal->id}/confirm")->assertConflict();
        $this->assertSame('expired', $proposal->fresh()->status);
    }

    public function test_unknown_or_transaction_functions_are_refused_to_the_model(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(self::functionCall('create_transaction', ['amount' => 1]))
            ->push(self::text('Mình không thể ghi giao dịch.'))]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'Ghi giúp tôi khoản chi 50k'])->assertOk();

        Http::assertSent(fn (HttpRequest $r) => data_get($r->data(), 'contents.2.parts.0.functionResponse.response.error') === 'Unknown function create_transaction');
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_briefing_is_generated_once_per_day_and_refresh_is_limited(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(self::text('- Hôm nay không có gì gấp.'))]);

        $this->actingAs($this->user)->getJson('/api/v1/ai/briefing')->assertOk()->assertJsonPath('data.date', '2026-10-22');
        $this->actingAs($this->user)->getJson('/api/v1/ai/briefing')->assertOk();
        Http::assertSentCount(1); // cached for the day

        foreach (range(1, 3) as $_) {
            $this->actingAs($this->user)->postJson('/api/v1/ai/briefing/refresh')->assertOk();
        }
        $this->actingAs($this->user)->postJson('/api/v1/ai/briefing/refresh')->assertTooManyRequests();
    }

    public function test_daily_chat_limit(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(self::text('ok'))]);
        foreach (range(1, 30) as $_) {
            $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'hi'])->assertOk();
        }
        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'hi'])->assertTooManyRequests();
    }

    /**
     * Each case gets its own test: Http::fake stubs stack, so a later fake in the same test never wins.
     *
     * @return array<string, array{int, array<string, mixed>, string}>
     */
    public static function providerFailures(): array
    {
        return [
            'quota' => [429, ['error' => ['message' => 'quota']], 'AI Coach đang quá tải (hết hạn mức miễn phí), thử lại sau ít phút.'],
            'retired model' => [404, ['error' => ['message' => 'models/x is not found']], 'Không tìm thấy model "gemini-test". Kiểm tra biến GEMINI_MODEL.'],
            'invalid key' => [400, ['error' => ['message' => 'API key not valid. Please pass a valid API key.', 'status' => 'INVALID_ARGUMENT']], 'GEMINI_API_KEY không hợp lệ. Tạo lại key trong AI Studio và cập nhật trên Render.'],
            'forbidden key' => [403, ['error' => ['message' => 'Permission denied']], 'GEMINI_API_KEY không có quyền dùng Gemini API (key bị chặn hoặc chưa bật API).'],
            'other 400' => [400, ['error' => ['message' => 'Invalid JSON payload received.']], 'Gemini từ chối yêu cầu (mã 400): Invalid JSON payload received.'],
            'overloaded everywhere' => [503, ['error' => ['message' => 'The model is overloaded.']], 'Gemini đang quá tải, vui lòng thử lại sau ít phút.'],
            'other server error' => [502, ['error' => ['message' => 'bad gateway']], 'AI Coach đang gặp lỗi (mã 502), vui lòng thử lại sau.'],
        ];
    }

    #[DataProvider('providerFailures')]
    public function test_provider_problems_are_friendly_503s(int $status, array $body, string $message): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($body, $status)]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'hi'])
            ->assertStatus(503)
            ->assertJsonPath('message', $message);
    }

    public function test_overloaded_model_is_retried_then_falls_back(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*/gemini-test:*' => Http::response(['error' => ['message' => 'The model is overloaded.']], 503),
            'generativelanguage.googleapis.com/*/gemini-lite-test:*' => Http::response(self::text('Trả lời từ model dự phòng')),
        ]);

        $this->actingAs($this->user)->postJson('/api/v1/ai/chat', ['message' => 'hi'])
            ->assertOk()
            ->assertJsonPath('data.reply', 'Trả lời từ model dự phòng');

        Http::assertSentCount(3); // main model twice (retry), then the fallback
        $this->assertDatabaseHas('ai_messages', ['role' => 'assistant', 'model' => 'gemini-lite-test']);
    }

    public function test_missing_key_is_a_friendly_503(): void
    {
        config(['services.gemini.key' => null]);

        $this->actingAs($this->user)->getJson('/api/v1/ai/briefing')
            ->assertStatus(503)
            ->assertJsonPath('message', 'AI Coach chưa được cấu hình (thiếu GEMINI_API_KEY).');
    }
}

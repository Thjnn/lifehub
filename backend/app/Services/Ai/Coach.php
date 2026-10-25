<?php

namespace App\Services\Ai;

use App\Models\AiConversation;
use App\Models\AiDailyBriefing;
use App\Models\User;
use App\Services\Finance\DebtSchedule;
use App\Services\Finance\FinanceReport;
use App\Services\Planning\EventOccurrences;
use App\Services\Weather\OpenMeteo;
use Illuminate\Support\Carbon;

/**
 * AI Coach orchestration (spec §9.5): Gemini decides which read-only functions to call, the backend runs them
 * scoped to the user, Gemini writes the answer from that data. Suggested changes become proposals.
 */
class Coach
{
    private const MAX_TOOL_ROUNDS = 4;

    private const HISTORY_MESSAGES = 10;

    // Pages with a floating assistant (frontend `features/ai/page-context.ts`) and their names in the prompt.
    public const PAGES = [
        'dashboard' => 'Tổng quan',
        'tasks' => 'Công việc',
        'calendar' => 'Lịch',
        'finance' => 'Tài chính · Tổng quan',
        'finance.transactions' => 'Tài chính · Giao dịch',
        'finance.accounts' => 'Tài chính · Tài khoản',
        'finance.budgets' => 'Tài chính · Ngân sách',
        'finance.reports' => 'Tài chính · Báo cáo',
        'nutrition' => 'Dinh dưỡng · Nhật ký',
        'nutrition.plan' => 'Dinh dưỡng · Thực đơn tuần',
        'nutrition.workouts' => 'Dinh dưỡng · Tập luyện',
        'nutrition.body' => 'Dinh dưỡng · Cân nặng',
    ];

    public function __construct(
        private Gemini $gemini,
        private EventOccurrences $events,
        private FinanceReport $report,
        private DebtSchedule $debts,
        private OpenMeteo $weather,
    ) {}

    /**
     * @return array{content: string, proposal_ids: list<int>}
     */
    public function chat(User $user, AiConversation $conversation, string $message, ?string $page = null, ?string $month = null, ?string $date = null): array
    {
        $tools = $this->tools($user, $conversation->id);

        // Recent turns as context (text only), then the new question. Asked from a page's assistant, the question
        // carries that page's data, fetched here from the database (never sent by the client). Only the plain
        // question is stored.
        $contents = $conversation->messages()->latest('id')->limit(self::HISTORY_MESSAGES)->get()->reverse()
            ->map(fn ($m) => ['role' => $m->role === 'assistant' ? 'model' : 'user', 'parts' => [['text' => $m->content]]])
            ->values()->all();
        $contents[] = ['role' => 'user', 'parts' => [['text' => $page ? $this->withPageContext($user, $tools, $message, $page, $month, $date) : $message]]];

        for ($round = 0; $round <= self::MAX_TOOL_ROUNDS; $round++) {
            $result = $this->gemini->generate($this->systemPrompt($user), $contents, AiTools::declarations());
            $calls = array_values(array_filter($result['parts'], fn ($p) => isset($p['functionCall'])));

            if ($calls === [] || $round === self::MAX_TOOL_ROUNDS) {
                $text = trim(implode("\n", array_column(array_filter($result['parts'], fn ($p) => isset($p['text'])), 'text')));

                $conversation->messages()->create(['role' => 'user', 'content' => $message]);
                $conversation->messages()->create([
                    'role' => 'assistant',
                    'content' => $text !== '' ? $text : 'Mình chưa trả lời được câu này, bạn thử hỏi cụ thể hơn nhé.',
                    'model' => $result['model'],
                    'token_usage' => $result['usage'],
                ]);

                return ['content' => $conversation->messages()->latest('id')->value('content'), 'proposal_ids' => $tools->proposalIds];
            }

            // Run the requested functions and hand the results back to the model.
            $contents[] = ['role' => 'model', 'parts' => $result['parts']];
            $contents[] = ['role' => 'user', 'parts' => array_map(fn ($p) => ['functionResponse' => [
                'name' => $p['functionCall']['name'],
                'response' => $tools->call($p['functionCall']['name'], $p['functionCall']['args'] ?? []),
            ]], $calls)];
        }

        throw new AiUnavailable('AI Coach không hoàn thành được câu trả lời.'); // unreachable: the last round returns
    }

    /**
     * One briefing per user per local day (spec §9.1, cached). $refresh regenerates it.
     */
    public function briefing(User $user, bool $refresh = false): AiDailyBriefing
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $today = Carbon::now($timezone)->toDateString();
        $existing = AiDailyBriefing::where('user_id', $user->id)->whereDate('briefing_date', $today)->first();
        if ($existing && ! $refresh) {
            return $existing;
        }

        // The briefing needs no back-and-forth: gather the day's data up front, one Gemini call.
        $tools = $this->tools($user, null);
        $context = [
            'today_schedule' => $tools->call('get_schedule', ['date_from' => $today, 'date_to' => $today]),
            'overdue_tasks' => $tools->call('get_tasks', ['scope' => 'overdue']),
            'upcoming_tasks' => $tools->call('get_tasks', ['scope' => 'upcoming_7_days']),
            'free_time_today' => $tools->call('get_free_time', ['date' => $today]),
            'budgets_this_month' => $tools->call('get_budgets', ['month' => substr($today, 0, 7)]),
            'debt_repayments_next_7_days' => $tools->call('get_debts', ['days' => 7]),
            'weather' => $tools->call('get_weather', []),
        ];

        $prompt = "Viết bản tóm tắt buổi sáng cho hôm nay ({$today}) dựa trên dữ liệu JSON dưới đây.\n"
            .'Tối đa 6 gạch đầu dòng ngắn: việc quan trọng nhất cần làm trước, lịch trong ngày, hạn chót/quá hạn, '
            .'ngân sách đáng chú ý, khoản nợ đến hạn, và thời tiết nếu ảnh hưởng tới lịch (ví dụ mưa giờ có sự kiện). '
            ."Kết thúc bằng 1 câu gợi ý thứ tự ưu tiên. Không bịa số liệu không có trong dữ liệu.\n\n"
            .json_encode($context, JSON_UNESCAPED_UNICODE);

        $result = $this->gemini->generate($this->systemPrompt($user), [['role' => 'user', 'parts' => [['text' => $prompt]]]]);
        $text = trim(implode("\n", array_column(array_filter($result['parts'], fn ($p) => isset($p['text'])), 'text')));

        // user_id isn't mass-assignable (on purpose), so set it explicitly rather than via updateOrCreate.
        $briefing = $existing ?? new AiDailyBriefing(['briefing_date' => $today]);
        $briefing->user_id = $user->id;
        $briefing->content = $text !== '' ? $text : 'Hôm nay chưa có gì nổi bật.';
        $briefing->save();

        return $briefing;
    }

    /**
     * The question prefixed with what the user is looking at: the page name and the data its tools return for the
     * page's month/day/week (defaults: this month, today). Saves Gemini a tool round, and the free tier's requests.
     */
    private function withPageContext(User $user, AiTools $tools, string $message, string $page, ?string $month, ?string $date): string
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $today = Carbon::now($timezone)->toDateString();
        $month ??= substr($today, 0, 7);
        $date ??= $today;
        $weekStart = Carbon::parse($date)->startOfWeek(Carbon::MONDAY);
        $plus = fn (int $days) => Carbon::parse($date)->addDays($days)->toDateString();

        $data = match ($page) {
            'dashboard' => [
                'today_schedule' => $tools->call('get_schedule', ['date_from' => $today, 'date_to' => $today]),
                'overdue_tasks' => $tools->call('get_tasks', ['scope' => 'overdue']),
                'budgets_this_month' => $tools->call('get_budgets', ['month' => $month]),
            ],
            'tasks' => [
                'open_tasks' => $tools->call('get_tasks', ['scope' => 'open']),
                'overdue_tasks' => $tools->call('get_tasks', ['scope' => 'overdue']),
            ],
            'calendar' => [
                'next_7_days' => $tools->call('get_schedule', ['date_from' => $today, 'date_to' => Carbon::parse($today)->addDays(6)->toDateString()]),
                'free_time_today' => $tools->call('get_free_time', ['date' => $today]),
            ],
            'finance', 'finance.reports' => [
                'spending' => $this->monthSpending($tools, $month),
                'budgets' => $tools->call('get_budgets', ['month' => $month]),
            ],
            'finance.transactions' => ['spending' => $this->monthSpending($tools, $month)],
            'finance.accounts' => ['debt_repayments_next_30_days' => $tools->call('get_debts', ['days' => 30])],
            'finance.budgets' => ['budgets' => $tools->call('get_budgets', ['month' => $month])],
            'nutrition' => ['nutrition_last_7_days' => $tools->call('get_nutrition', ['date_from' => $plus(-6), 'date_to' => $date])],
            'nutrition.plan' => ['meal_plan_week' => $tools->call('get_nutrition', ['date_from' => $weekStart->toDateString(), 'date_to' => $weekStart->copy()->addDays(6)->toDateString()])],
            'nutrition.workouts', 'nutrition.body' => ['fitness_last_30_days' => $tools->call('get_fitness', ['days' => 30])],
        };

        return '[Người dùng đang xem trang "'.self::PAGES[$page].'" của LIFEHUB'
            .($page === 'nutrition' ? ", ngày {$date}" : ($page === 'nutrition.plan' ? ", tuần bắt đầu {$weekStart->toDateString()}" : (str_starts_with($page, 'finance') ? ", tháng {$month}" : '')))
            .'. Dữ liệu trên trang đó (JSON), dùng để trả lời; cần thêm thì gọi hàm:]'."\n"
            .json_encode($data, JSON_UNESCAPED_UNICODE)."\n\n[Câu hỏi:]\n{$message}";
    }

    /**
     * @return array<string, mixed>
     */
    private function monthSpending(AiTools $tools, string $month): array
    {
        $start = Carbon::createFromFormat('!Y-m', $month);

        return $tools->call('get_spending', ['date_from' => $start->toDateString(), 'date_to' => $start->copy()->endOfMonth()->toDateString()]);
    }

    private function tools(User $user, ?int $conversationId): AiTools
    {
        return new AiTools($user, $conversationId, $this->events, $this->report, $this->debts, $this->weather);
    }

    private function systemPrompt(User $user): string
    {
        $timezone = $user->settings?->timezone ?? config('app.timezone');
        $now = Carbon::now($timezone);
        $name = trim(collect(explode(' ', trim($user->name)))->last() ?? '');

        return <<<PROMPT
            Bạn là AI Coach của LIFEHUB, trợ lý quản lý lịch, công việc và tài chính cá nhân. Người dùng tên {$name}.
            Bây giờ là {$now->format('Y-m-d H:i')} ({$now->isoFormat('dddd')}), múi giờ {$timezone}. Tiền tệ: VND.

            Quy tắc:
            - Trả lời bằng tiếng Việt, ngắn gọn, thân thiện. Dùng gạch đầu dòng khi liệt kê.
            - Chỉ dùng số liệu lấy từ các hàm được cung cấp. Không bịa số. Thiếu dữ liệu thì nói rõ.
            - Cần dữ liệu thì gọi hàm; "tuần này" = thứ Hai đến Chủ Nhật của tuần hiện tại.
            - Muốn thêm công việc hoặc sự kiện: gọi propose_task / propose_event, rồi nói người dùng bấm "Xác nhận". Không bao giờ nói là đã tạo.
            - Gợi ý món ăn hoặc thực đơn: gọi get_nutrition trước để biết mục tiêu và sở thích (dị ứng, món không ăn), tuyệt đối không gợi ý món người dùng dị ứng.
            - Bạn KHÔNG thể tạo, sửa hay xoá giao dịch tài chính. Nếu được nhờ, hướng dẫn người dùng tự ghi trong mục Tài chính.
            - Không đưa lời khuyên đầu tư; không thay thế tư vấn y tế/dinh dưỡng chuyên môn.
            PROMPT;
    }
}

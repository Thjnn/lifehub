<?php

namespace Database\Seeders;

use App\Enums\AccountType;
use App\Enums\EventType;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Enums\TransactionType;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Event;
use App\Models\Note;
use App\Models\Task;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo data for screenshots and local tries (spec §16 rule 8: labelled as demo).
 * Account: demo@lifehub.test / password. Re-running replaces the demo user's data; dates follow today.
 *
 *   php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        User::where('email', 'demo@lifehub.test')->first()?->purge();

        $user = User::factory()->create(['name' => 'Tài khoản demo', 'email' => 'demo@lifehub.test']);
        $now = now('Asia/Ho_Chi_Minh');
        $at = fn (int $days, int $hour, int $minute = 0) => $now->copy()->addDays($days)->setTime($hour, $minute)->utc();

        foreach ([
            ['Nộp báo cáo môn Cơ sở dữ liệu', TaskPriority::Urgent, TaskStatus::InProgress, $at(0, 17)],
            ['Ôn tập giữa kỳ Mạng máy tính', TaskPriority::High, TaskStatus::Todo, $at(2, 20)],
            ['Gia hạn thẻ thư viện', TaskPriority::Low, TaskStatus::Todo, $at(-1, 12)],
            ['Dọn phòng, giặt đồ', TaskPriority::Medium, TaskStatus::Todo, $at(1, 9)],
            ['Đăng ký học phần kỳ sau', TaskPriority::High, TaskStatus::Completed, $at(-2, 10)],
        ] as [$title, $priority, $status, $due]) {
            Task::factory()->for($user)->create(['title' => $title, 'description' => 'Dữ liệu demo', 'priority' => $priority, 'status' => $status, 'due_at' => $due]);
        }

        $class = Event::factory()->for($user)->create(['title' => 'Học Cấu trúc dữ liệu', 'event_type' => EventType::Study, 'location' => 'Phòng B2.04', 'start_at' => $at(0, 7, 30), 'end_at' => $at(0, 9, 30), 'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=MO,WE,FR']);
        Event::factory()->for($user)->create(['title' => 'Tập gym', 'event_type' => EventType::Workout, 'start_at' => $at(0, 18), 'end_at' => $at(0, 19), 'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=TU,TH,SA']);
        Event::factory()->for($user)->create(['title' => 'Ca làm thêm quán cà phê', 'event_type' => EventType::Work, 'location' => 'Highlands Nguyễn Huệ', 'start_at' => $at(1, 13), 'end_at' => $at(1, 17)]);

        $report = $user->tasks()->where('title', 'Nộp báo cáo môn Cơ sở dữ liệu')->value('id');
        Note::factory()->for($user)->create(['title' => 'Dàn ý báo cáo (demo)', 'body' => "1. Giới thiệu đề tài\n2. Thiết kế ERD\n3. Chuẩn hoá 3NF\n4. Kết luận", 'pinned' => true, 'task_id' => $report]);
        Note::factory()->for($user)->create(['title' => 'Bài tập về nhà (demo)', 'body' => 'Cài đặt cây AVL, nộp trước buổi học sau.', 'event_id' => $class->id]);
        Note::factory()->for($user)->create(['title' => null, 'body' => 'Mua: sữa, trứng, bánh mì (demo)']);

        $cash = Account::factory()->for($user)->create(['name' => 'Tiền mặt', 'account_type' => AccountType::Cash, 'opening_balance' => '800000.00']);
        $bank = Account::factory()->for($user)->create(['name' => 'Ngân hàng', 'account_type' => AccountType::Bank, 'opening_balance' => '3500000.00']);
        $later = Account::factory()->for($user)->create(['name' => 'SPayLater', 'account_type' => AccountType::Liability, 'credit_limit' => '6000000.00', 'due_day' => 10]);

        $category = fn (string $name) => Category::whereNull('user_id')->where('name', $name)->value('id');
        $month = $now->copy()->startOfMonth();
        foreach ([
            [TransactionType::Income, $bank, 'Thu nhập', '4000000.00', 1, 'Lương làm thêm'],
            [TransactionType::Expense, $cash, 'Ăn uống', '45000.00', 2, 'Cơm trưa'],
            [TransactionType::Expense, $bank, 'Nhà ở', '1800000.00', 3, 'Tiền phòng'],
            [TransactionType::Expense, $cash, 'Đi lại', '120000.00', 4, 'Đổ xăng'],
            [TransactionType::Expense, $later, 'Học tập', '450000.00', 5, 'Mua giáo trình (trả sau)'],
            [TransactionType::Expense, $bank, 'Gym', '300000.00', 6, 'Phí gym tháng'],
            [TransactionType::Expense, $cash, 'Giải trí', '150000.00', 7, 'Xem phim'],
        ] as [$type, $account, $name, $amount, $day, $description]) {
            Transaction::factory()->create([
                'type' => $type, 'account_id' => $account->id, 'category_id' => $category($name), 'amount' => $amount,
                // Days past today would be in the future: keep them within the month so far.
                'occurred_at' => $month->copy()->addDays(min($day, $now->day) - 1)->setTime(12, 0)->utc(),
                'description' => "{$description} (demo)",
            ]);
        }

        Budget::forceCreate(['user_id' => $user->id, 'category_id' => null, 'period_start' => $month->toDateString(), 'period_end' => $month->copy()->endOfMonth()->toDateString(), 'amount' => '3500000.00']);
        Budget::forceCreate(['user_id' => $user->id, 'category_id' => $category('Ăn uống'), 'period_start' => $month->toDateString(), 'period_end' => $month->copy()->endOfMonth()->toDateString(), 'amount' => '1500000.00']);
    }
}

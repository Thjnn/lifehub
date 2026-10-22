# LIFEHUB — Personal Life Management System

> **Product specification / Project brief**
> Phiên bản: **1.1** (cập nhật từ v1.0)
> Mục tiêu: Xây dựng web app quản lý cuộc sống cá nhân (Personal Life OS), **cài đặt được như ứng dụng (PWA, hỗ trợ offline)**, toàn bộ hạ tầng dùng **gói miễn phí**.

---

## 0. Thay đổi so với v1.0

| Hạng mục | v1.0 | v1.1 |
|---|---|---|
| Database | MySQL 8 | **PostgreSQL** (host trên **Supabase** free tier) |
| Môi trường | Không quy định | **Docker** + `docker compose` cho dev local; backend deploy bằng Dockerfile |
| Hosting backend | VPS | **Render** (free web service, deploy từ Dockerfile) |
| Hosting frontend | Vercel | **Vercel** (Hobby, free) |
| Auth | Sanctum SPA cookie | **Sanctum API token (Bearer)** — vì frontend và backend khác site |
| Ứng dụng | Web thường | **PWA**: cài được, chạy offline (app shell + đọc offline + ghi offline có giới hạn) |
| Scope MVP | 7 module | **Cắt gọn**: Auth, Dashboard, Tasks, Calendar, Finance, AI Briefing. Fitness/Nutrition/Habits sang v2 |
| Tiền tệ | Đa tiền tệ chưa rõ quy tắc | **MVP chỉ VND** |
| Chi phí | Không quy định | **0 đồng** — chỉ dùng free tier |

---

## 1. Tổng quan dự án

**LIFEHUB** giúp người dùng quản lý lịch trình, công việc, tài chính, (sau này) tập luyện và dinh dưỡng trong một ứng dụng duy nhất, kèm AI Coach đưa gợi ý dựa trên dữ liệu thật.

### Nguyên tắc sản phẩm
- **One source of truth:** mọi dữ liệu nằm trong một tài khoản, không nhập trùng.
- **Action over information:** giao diện chỉ ra việc cần làm tiếp theo.
- **AI as a copilot:** AI phân tích và đề xuất; người dùng xác nhận mọi thay đổi dữ liệu.
- **Privacy by design:** dữ liệu chỉ truy cập theo user đã xác thực; AI chỉ nhận dữ liệu tối thiểu; cache offline bị xóa khi logout.
- **Offline-capable:** mở app, xem dữ liệu gần nhất và ghi nhận task/giao dịch khi mất mạng.

### Đối tượng
Sinh viên, người đi làm muốn quản lý thời gian, chi tiêu và thói quen.

### Định vị
Premium SaaS, tối giản, rõ ràng (cảm hứng từ Linear, Vercel, Stripe) nhưng có nhận diện riêng, không sao chép.

### Mục đích phụ
Dự án portfolio Full-stack thể hiện: React + TypeScript, Laravel REST API, PostgreSQL, Docker, PWA/offline sync, tích hợp AI, CI/CD.

---

## 2. Công nghệ

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui + Lucide icons
- React Router
- TanStack Query (server state, cache) + `@tanstack/query-sync-storage-persister` hoặc persister IndexedDB (`idb-keyval`) để đọc offline
- React Hook Form + Zod
- Recharts (biểu đồ)
- FullCalendar (lịch)
- **vite-plugin-pwa** (Workbox) cho manifest + service worker
- **Dexie.js** (IndexedDB) cho hàng đợi ghi offline (outbox)

### Backend
- Laravel (phiên bản LTS/mới nhất ổn định) + PHP tương thích
- Laravel Sanctum — **personal access tokens**
- Form Requests, Policies, API Resources, Services/Actions
- Pest hoặc PHPUnit
- Driver DB: `pgsql`

### Database & dịch vụ
- PostgreSQL (Supabase)
- Supabase Storage (S3-compatible) — chỉ khi cần lưu file, dùng private bucket + signed URL
- Gemini API (free tier) — **chỉ gọi từ Laravel**
- Git + GitHub, GitHub Actions (CI)
- OpenAPI/Swagger (ví dụ `dedoc/scramble` để sinh docs tự động)

### Kiến trúc
**Modular monolith** cho Laravel. Không microservices. Monorepo gồm `frontend/` và `backend/` triển khai độc lập.

---

## 3. Hạ tầng miễn phí & triển khai

| Thành phần | Dịch vụ | Ghi chú free tier |
|---|---|---|
| Frontend (static PWA) | Vercel Hobby | Chỉ dùng non-commercial. HTTPS sẵn |
| Backend Laravel | Render Free Web Service (Docker) | Sleep sau ~15 phút không có request; request đầu mất 30–60s. Không có persistent disk, không có background worker/cron trên gói free |
| PostgreSQL | Supabase Free | Project bị pause nếu không hoạt động ~1 tuần (restore trong dashboard). Có giới hạn dung lượng |
| File storage | Supabase Storage | Chỉ dùng khi cần |
| AI | Gemini API free tier | Có giới hạn request/phút và /ngày → bắt buộc rate limit phía backend |
| CI | GitHub Actions | Free cho repo public |

> Giới hạn free tier có thể thay đổi — kiểm tra lại trang pricing khi bắt đầu.

### Hệ quả kỹ thuật bắt buộc
1. **Không phụ thuộc queue worker / scheduler chạy nền.** Dùng `QUEUE_CONNECTION=sync`. Tác vụ định kỳ (nếu có) được kích hoạt bởi **GitHub Actions cron** gọi một endpoint bảo vệ bằng secret.
2. **Không lưu file trên disk của Render** (bị xóa mỗi lần deploy). Log ra `stderr`, file lên Supabase Storage.
3. **Kết nối Supabase từ Render:** dùng **connection string của Supavisor pooler** (IPv4). Khuyến nghị **Session pooler (port 5432)**. Nếu dùng Transaction pooler (port 6543) thì bật `PDO::ATTR_EMULATE_PREPARES => true` trong config `pgsql`. Luôn `sslmode=require`.
4. **Cold start:** frontend phải có trạng thái "Đang đánh thức máy chủ…" khi request đầu chậm, và nhờ cache offline, người dùng vẫn thấy dữ liệu cũ trong lúc chờ.
5. **Migration khi deploy:** chạy `php artisan migrate --force` trong entrypoint/start command của container.
6. Không mở Postgres công khai ngoài những gì Supabase quản lý; không commit secret.

---

## 4. Docker

### Dev local (`docker compose`)
```text
services:
  app       → PHP-FPM + Laravel (mount ./backend)
  web       → Nginx (port 8000 → app)
  db        → postgres:16 (volume pgdata, port 5432)
  (tùy chọn) mailpit → test email reset password
```
- Frontend chạy ngoài Docker bằng `npm run dev` (Vite) cho tốc độ HMR; gọi API `http://localhost:8000/api/v1`.
- Cung cấp `backend/.env.example` và `frontend/.env.example`.

### Production (Render)
- `backend/Dockerfile` multi-stage: stage `composer install --no-dev --optimize-autoloader`, stage runtime (php-fpm + nginx, hoặc FrankenPHP / `php artisan serve` đơn giản nếu cần).
- Lắng nghe trên biến môi trường `PORT` của Render.
- Entrypoint: `php artisan config:cache && php artisan route:cache && php artisan migrate --force` rồi start server.
- Health check endpoint: `GET /api/health`.

---

## 5. Authentication & bảo mật

- **Sanctum personal access token**:
  - `POST /api/v1/auth/register`, `/auth/login` → trả token.
  - `POST /api/v1/auth/logout` → thu hồi token hiện tại.
  - Token có `expiration` (ví dụ 7–30 ngày), đặt tên theo thiết bị.
- Frontend gửi `Authorization: Bearer <token>`. Lưu token trong `localStorage` (chấp nhận rủi ro XSS, bù lại bằng CSP chặt, không dùng `dangerouslySetInnerHTML`, token hết hạn).
- **CORS:** chỉ cho phép origin của frontend (domain Vercel + `localhost:5173`).
- Forgot password: Laravel password broker; email gửi qua SMTP free (ví dụ Brevo/Resend free tier) hoặc log ra stderr trong dev.
- Policies cho mọi resource; mọi query giới hạn `where user_id = auth()->id()`. Không tin ID từ client.
- Rate limit: auth endpoints và AI endpoints.
- Không ghi dữ liệu nhạy cảm vào log.
- Backup: dùng `pg_dump` định kỳ qua GitHub Actions (lưu artifact private) vì backup tự động của Supabase free có giới hạn.
- **Logout phải xóa toàn bộ cache offline** (TanStack persisted cache + Dexie outbox + Cache Storage chứa API).

---

## 6. PWA & Offline

### 6.1. Cài đặt như ứng dụng
- `manifest.webmanifest`: `name`, `short_name`, `start_url: /app/dashboard`, `display: standalone`, `theme_color: #0B0D12`, `background_color: #0B0D12`, icons 192/512 + maskable.
- Nút "Cài đặt LIFEHUB" dùng sự kiện `beforeinstallprompt` (Android/desktop Chrome). Trên iOS: hiển thị hướng dẫn "Share → Add to Home Screen".
- Thông báo khi có phiên bản mới (`registerType: 'prompt'`), cho người dùng bấm "Cập nhật".

### 6.2. Ba mức offline

| Mức | Nội dung | Phạm vi MVP |
|---|---|---|
| **1. App shell** | Precache HTML/JS/CSS/fonts/icons. Mở app offline vẫn thấy giao diện | ✅ Bắt buộc |
| **2. Đọc offline** | TanStack Query persist cache vào IndexedDB; offline hiển thị dữ liệu lần cuối + badge "Offline — dữ liệu lúc HH:mm" | ✅ Bắt buộc |
| **3. Ghi offline** | Tạo/sửa/hoàn thành **Task** và tạo **Transaction** khi offline → lưu vào outbox → tự sync khi online | ✅ Chỉ 2 entity này |

Không hỗ trợ offline: AI Coach, báo cáo tổng hợp từ server, xóa dữ liệu tài chính (cần online để tránh xung đột).

### 6.3. Thiết kế ghi offline (outbox pattern)
- Mỗi bản ghi tạo từ client có **UUID do client sinh** (`crypto.randomUUID()`), dùng làm khóa chính hoặc cột `client_id` unique → **API idempotent**, gửi lại không tạo trùng.
- Outbox (Dexie): `{ id, method, endpoint, payload, created_at, attempts, status }`.
- Optimistic update: UI hiển thị ngay bản ghi với nhãn "Chưa đồng bộ".
- Sync khi: sự kiện `online`, mở app, hoặc định kỳ khi đang online. Xử lý tuần tự theo thứ tự tạo.
- **Conflict:** last-write-wins dựa trên `updated_at` cho Task. Nếu server trả 409/422 → đánh dấu lỗi, hiển thị cho người dùng sửa thủ công, không âm thầm bỏ.
- Background Sync API chỉ dùng như cải tiến (không có trên iOS), luôn có fallback sync khi mở app.

### 6.4. Service worker caching
- Static assets: `CacheFirst` (precache).
- API GET: **không** cache bằng Workbox (đã có TanStack persist), tránh lưu dữ liệu cá nhân hai nơi.
- Fonts Google (nếu dùng): `StaleWhileRevalidate`.

---

## 7. UI/UX

### Hướng thiết kế
- Premium SaaS, dark mode mặc định, light mode nếu kịp.
- Typography rõ, khoảng trắng hợp lý, card viền mảnh, shadow nhẹ.
- Không gradient sặc sỡ, không glassmorphism nặng. Animation nhanh và nhẹ.
- Responsive: desktop, tablet, mobile. **Mobile-first cho PWA**: bottom navigation trên mobile.

### Design tokens
| Token | Giá trị | Dùng cho |
|---|---|---|
| App background | `#0B0D12` | Nền chính |
| Surface | `#151922` | Sidebar, card |
| Primary blue | `#5B8CFF` | CTA, active, focus |
| Success green | `#34D399` | Hoàn thành |
| Finance accent | `#FBBF24` | Ngân sách, cảnh báo nhẹ |
| Danger | `#F87171` | Lỗi, vượt ngân sách |
| Primary text | `#E5E7EB` | Chữ chính |
| Secondary text | `#9CA3AF` | Chữ phụ |

Kiểm tra contrast WCAG AA trước khi phát hành.

### Quy chuẩn
- Font: Inter hoặc Geist (self-host để chạy offline).
- Sidebar 240–260px (desktop), topbar 60–68px, spacing bội số 4/8px, card radius 12–16px, button cao 36–44px.
- Trạng thái bắt buộc: loading skeleton, empty, error, offline, "chưa đồng bộ", success toast, confirm dialog.
- Dữ liệu demo phải được đánh dấu là demo.

### Layout
- Desktop: Sidebar + Topbar (tiêu đề, tìm kiếm nhanh, chỉ báo online/offline, avatar) + Main.
- Mobile: Bottom nav (Dashboard, Tasks, Calendar, Finance, More) + nút Quick Create nổi.
- Quick create: task, event, transaction.

---

## 8. Routes

### Public
- `/` Landing · `/login` · `/register` · `/forgot-password` · `/reset-password`

### Authenticated (MVP)
- `/app/dashboard`
- `/app/calendar`
- `/app/tasks`
- `/app/finance` · `/app/finance/transactions` · `/app/finance/accounts` · `/app/finance/budgets` · `/app/finance/reports`
- `/app/ai-coach`
- `/app/settings/profile` · `/app/settings/preferences` · `/app/settings/privacy`

### v2 (chưa làm)
- `/app/habits`, `/app/goals`, `/app/fitness/*`, `/app/nutrition/*`, `/app/finance/goals`

---

## 9. Tính năng MVP

### 9.1. Dashboard
- Lời chào + ngày hiện tại (theo timezone user).
- Task: đã xong / tổng hôm nay; task sắp đến hạn và quá hạn.
- Timeline sự kiện hôm nay.
- Finance: chi tiêu tháng này, ngân sách còn lại.
- AI Daily Briefing (cache theo ngày, có nút làm mới).
- Quick actions.
- Dữ liệu từ API thật, mỗi chỉ số có kỳ và đơn vị. Không hardcode số.

### 9.2. Calendar
- Chế độ Day, Week, Month, Agenda.
- CRUD event: title, description, start_at, end_at, event_type (`study`, `work`, `workout`, `rest`, `personal`), status.
- Recurring events cơ bản: lưu `recurrence_rule` dạng RRULE, **expand ở backend** cho khoảng thời gian được query (thư viện RRULE cho PHP).
- Cảnh báo trùng giờ (không chặn).
- Filter theo loại và khoảng thời gian.
- Task có deadline hiển thị trên lịch dưới dạng mục riêng, **không** gộp với event.
- Calendar: chỉ đọc khi offline.

### 9.3. Tasks (hỗ trợ offline)
- CRUD; trường: title, description, priority (`low`, `medium`, `high`, `urgent`), status (`todo`, `in_progress`, `completed`, `cancelled`), due_at.
- Đánh dấu hoàn thành (set `completed_at`).
- Lọc theo status, priority, hạn chót; sắp xếp.
- Kiểm tra quyền sở hữu.

### 9.4. Finance
- Accounts: tiền mặt, ngân hàng, ví điện tử (nhập tay); `opening_balance`.
- Categories mặc định (seed) + tùy chỉnh: ăn uống, học tập, nhà ở, đi lại, gym, giải trí, thu nhập, khác.
- Transactions (tạo được khi offline): `income`, `expense`, `transfer`.
- Budgets theo tháng + danh mục; hiển thị % đã dùng, cảnh báo khi > 80% và > 100%.
- Reports: tổng thu/chi theo tháng, theo danh mục, so sánh tháng trước.

**Quy tắc nghiệp vụ**
- Tiền dùng `NUMERIC(15,2)`; MVP chỉ VND (vẫn giữ cột `currency` mặc định `VND` để mở rộng).
- Transfer = **một bản ghi** có `account_id` (nguồn) và `to_account_id` (đích); không tính vào thu/chi tiêu dùng.
- Số dư tài khoản = `opening_balance + income − expense − transfer_out + transfer_in`, tính bằng SQL aggregate (chưa cần cache).
- Bắt buộc: ngày phát sinh, tài khoản, loại, số tiền > 0.
- AI không bao giờ tự tạo giao dịch.

### 9.5. AI Coach (chỉ online)
Chế độ MVP:
1. **Daily Briefing:** tóm tắt lịch, deadline, ngân sách; gợi ý thứ tự ưu tiên.
2. **Ask LIFEHUB:** hỏi tự nhiên, ví dụ "Tuần này tôi tiêu bao nhiêu tiền ăn?", "Chiều nay tôi rảnh lúc nào?"

Quy trình:
1. Frontend gửi câu hỏi tới `POST /api/v1/ai/chat`.
2. Backend xác thực + rate limit (theo user, theo ngày).
3. AI Orchestrator phân loại intent (rule-based hoặc gọi Gemini với function calling).
4. Gọi domain service lấy dữ liệu đã phân quyền, **đã tổng hợp** (không gửi dữ liệu thô dư thừa).
5. Gemini sinh câu trả lời từ dữ liệu đó.
6. Backend kiểm tra, lưu `ai_messages`, trả kết quả.
7. Nếu có đề xuất tạo/sửa dữ liệu → tạo `ai_action_proposals`, frontend hiển thị preview, người dùng bấm xác nhận mới thực thi.

Xử lý: timeout, lỗi provider, vượt quota → thông báo thân thiện, không làm hỏng trang.

### 9.6. Settings
- Profile, timezone (mặc định `Asia/Ho_Chi_Minh`), locale, theme.
- Privacy: xuất dữ liệu (JSON), xóa tài khoản, xóa cache offline trên thiết bị.

---

## 10. Database schema (PostgreSQL)

### Quy ước
- Khóa chính: `BIGINT GENERATED ... AS IDENTITY` (Laravel `id()`) cho bảng thường.
- **Bảng hỗ trợ ghi offline (`tasks`, `transactions`) dùng `UUID` làm khóa chính** (Laravel `uuid('id')->primary()` + trait `HasUuids`), client có thể tự sinh.
- Thời gian: `TIMESTAMPTZ` (Laravel `timestampTz`), lưu UTC, hiển thị theo timezone user.
- Tiền: `NUMERIC(15,2)`.
- Enum: `VARCHAR` + `CHECK` constraint (hoặc validate ở Laravel bằng PHP enum) — tránh Postgres native enum để dễ migrate.
- JSON: `JSONB`.
- Timestamps cho mọi bảng; soft delete cho `tasks`, `transactions`.

### Nền tảng
**users**: id, name, email (unique), password, email_verified_at, timestamps
**personal_access_tokens**: (Sanctum mặc định)
**user_settings**: id, user_id (unique FK), timezone, locale, currency (default `VND`), theme, preferences (JSONB), timestamps

### Planning
**events**: id, user_id FK, title, description?, start_at, end_at, event_type, status, recurrence_rule?, timestamps
- CHECK `end_at > start_at`

**tasks**: id (UUID), user_id FK, title, description?, priority, status, due_at?, completed_at?, timestamps, deleted_at?

### Finance
**accounts**: id, user_id FK, name, account_type (`cash`, `bank`, `ewallet`), currency, opening_balance NUMERIC(15,2), is_active, timestamps

**categories**: id, user_id? FK (null = mặc định hệ thống), name, type (`income`, `expense`), icon?, color?, timestamps

**transactions**: id (UUID), user_id FK, account_id FK, to_account_id? FK (chỉ khi transfer), category_id? FK, type (`income`, `expense`, `transfer`), amount NUMERIC(15,2) CHECK > 0, currency, occurred_at, description?, timestamps, deleted_at?
- CHECK: `type = 'transfer'` ⇔ `to_account_id IS NOT NULL` và `to_account_id <> account_id`
- CHECK: transfer thì `category_id IS NULL`

**budgets**: id, user_id FK, category_id? FK (null = tổng ngân sách), period_start (date), period_end (date), amount NUMERIC(15,2), currency, timestamps
- UNIQUE (user_id, category_id, period_start)

### AI
**ai_conversations**: id, user_id FK, title?, timestamps
**ai_messages**: id, conversation_id FK, role (`user`, `assistant`), content, model?, token_usage? (JSONB), timestamps
**ai_action_proposals**: id, user_id FK, conversation_id? FK, action_type, payload (JSONB), status (`pending`, `confirmed`, `rejected`, `expired`), expires_at, confirmed_at?, timestamps
**ai_daily_briefings**: id, user_id FK, briefing_date, content, timestamps — UNIQUE (user_id, briefing_date)

### Index
- `events (user_id, start_at)`
- `tasks (user_id, status, due_at)`
- `transactions (user_id, occurred_at)`
- `transactions (user_id, category_id, occurred_at)`
- `transactions (account_id)`, `transactions (to_account_id)`

Chỉ thêm index theo truy vấn thực tế.

### Schema v2 (tham khảo, chưa tạo)
- `habits`, `habit_logs` (bỏ cột `user_id` dư thừa, lấy owner qua `habit_id`; UNIQUE (habit_id, log_date))
- `goals`
- `exercises`, `workouts`, `workout_sets`, `body_measurements`
- `foods`, `food_entries` (có nutrition snapshot), `meal_plans`, `meal_plan_items`
- `savings_goals` + `savings_contributions` (current_amount **tính từ contributions**, không lưu cứng)
- `notifications`

---

## 11. REST API

Prefix `/api/v1`. Response chuẩn hóa bằng API Resources: `{ "data": ..., "meta": ... }`. Lỗi validation theo format mặc định Laravel (422).

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/health` | Health check (ngoài prefix cũng được) |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Auth |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Khôi phục mật khẩu |
| GET | `/me` | User + settings |
| PATCH | `/me/settings` | Cập nhật settings |
| GET | `/dashboard` | Tổng hợp dashboard |
| GET, POST | `/events` | Danh sách (filter `from`, `to`, `type`) / tạo |
| PATCH, DELETE | `/events/{id}` | Sửa / xóa |
| GET | `/tasks` | Danh sách (filter, pagination) |
| PUT | `/tasks/{uuid}` | **Upsert idempotent** (dùng cho cả online và sync offline) |
| POST | `/tasks/{uuid}/complete` | Hoàn thành |
| DELETE | `/tasks/{uuid}` | Xóa |
| GET, POST | `/accounts` · PATCH, DELETE `/accounts/{id}` | Tài khoản |
| GET | `/categories` · POST, PATCH, DELETE | Danh mục |
| GET | `/transactions` | Danh sách (filter tháng, account, category, type) |
| PUT | `/transactions/{uuid}` | **Upsert idempotent** |
| DELETE | `/transactions/{uuid}` | Xóa (chỉ online) |
| GET, POST | `/budgets` · PATCH, DELETE `/budgets/{id}` | Ngân sách |
| GET | `/reports/finance?month=YYYY-MM` | Báo cáo |
| GET | `/ai/briefing` · POST `/ai/briefing/refresh` | Daily briefing |
| POST | `/ai/chat` | Chat |
| POST | `/ai/proposals/{id}/confirm`, `/ai/proposals/{id}/reject` | Xác nhận đề xuất |
| GET | `/privacy/export` · DELETE `/me` | Xuất dữ liệu / xóa tài khoản |

Danh sách hỗ trợ pagination (`page`, `per_page`). Tài liệu OpenAPI sinh tự động và commit vào `docs/`.

---

## 12. Cấu trúc thư mục

```text
lifehub/
├── docker-compose.yml
├── .github/workflows/
│   ├── ci.yml            # lint + test frontend/backend
│   ├── keepalive.yml     # (tùy chọn) ping /api/health
│   └── backup.yml        # pg_dump định kỳ
├── frontend/
│   ├── public/icons/
│   ├── src/
│   │   ├── app/          # router.tsx, providers.tsx, query-client.ts
│   │   ├── components/   # ui/ (shadcn), shared/
│   │   ├── layouts/      # AppLayout (sidebar/bottom-nav), AuthLayout
│   │   ├── features/
│   │   │   ├── auth/ dashboard/ calendar/ tasks/ finance/ ai-coach/ settings/
│   │   ├── offline/      # db.ts (Dexie), outbox.ts, sync.ts, network-status.ts
│   │   ├── lib/          # api-client.ts, utils.ts, format.ts
│   │   └── types/
│   ├── vite.config.ts    # có vite-plugin-pwa
│   └── .env.example      # VITE_API_URL
├── backend/
│   ├── Dockerfile
│   ├── docker/           # nginx.conf, entrypoint.sh
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/  Requests/  Resources/
│   │   ├── Models/  Policies/  Enums/
│   │   ├── Services/     # Planning/, Finance/, Ai/
│   │   └── Actions/
│   ├── routes/api.php
│   ├── database/migrations/ factories/ seeders/
│   ├── tests/
│   └── .env.example
└── docs/
    ├── api-spec.yaml
    ├── database-schema.md
    └── architecture.md
```

---

## 13. Lộ trình (bán thời gian, ~8–10 tuần)

| Phase | Nội dung | Đầu ra |
|---|---|---|
| **1. Foundation** | Monorepo, Docker compose (Laravel + Postgres), Vite + Tailwind + shadcn, design tokens, CI cơ bản | `docker compose up` + `npm run dev` chạy được |
| **2. Auth + Shell** | Sanctum token, register/login/logout/forgot, route guard, layout responsive (sidebar + bottom nav) | Đăng nhập được, có khung app |
| **3. Deploy sớm** | Supabase project, Render (Dockerfile), Vercel, env vars, CORS, health check | App online có HTTPS — **deploy từ sớm để bắt lỗi hạ tầng** |
| **4. PWA mức 1–2** | Manifest, icons, service worker, install prompt, TanStack persist, chỉ báo offline | Cài được, mở offline xem dữ liệu cũ |
| **5. Tasks + Calendar** | CRUD, filter, calendar views, recurring cơ bản, test policy | Quản lý việc và lịch |
| **6. Finance** | Accounts, categories, transactions, budgets, reports, test số dư/transfer | Tài chính chạy đúng |
| **7. Offline mức 3** | Dexie outbox, UUID client, upsert idempotent, sync + xử lý lỗi cho Tasks/Transactions | Ghi offline rồi tự đồng bộ |
| **8. Dashboard + AI** | Dashboard tổng hợp, Gemini qua backend, briefing, chat, proposals, rate limit | AI trả lời từ dữ liệu thật |
| **9. QA & Release** | Test, accessibility, responsive, seed demo, README, API docs, backup workflow, rà soát bảo mật | MVP demo được, đưa vào portfolio |
| **10. Nutrition + Food scan** *(v2, ngay sau MVP)* | `foods` (seed món Việt), `food_entries`, nhật ký ăn uống; quét món bằng camera qua Gemini (chi tiết mục 15.1) | Chụp món → xác nhận → ghi nhật ký calo |
| **11. Nhắc hạn chót (Web Push)** *(v2, sau Phase 10)* | Push subscription, VAPID, GitHub Actions cron 2 lần/ngày, service worker nhận push, bật/tắt trong Settings (chi tiết mục 15.2) | Nhận thông báo việc sắp đến hạn |

---

## 14. Tiêu chí nghiệm thu MVP

### Core
- [ ] `docker compose up` dựng được backend + Postgres local; README hướng dẫn đầy đủ.
- [ ] Đăng ký, đăng nhập, đăng xuất, quên mật khẩu hoạt động.
- [ ] Dashboard hiển thị dữ liệu thật theo user.
- [ ] Có loading, empty, error, offline states.

### PWA & Offline
- [ ] Lighthouse PWA installable đạt; cài được trên Android/desktop Chrome; có hướng dẫn iOS.
- [ ] Tắt mạng: app vẫn mở, hiển thị dữ liệu lần cuối kèm thời điểm.
- [ ] Tắt mạng: tạo task và giao dịch được; bật mạng: tự đồng bộ, **không tạo trùng** khi gửi lại.
- [ ] Logout xóa sạch cache offline.

### Finance
- [ ] Số dư đúng với income/expense/transfer.
- [ ] Transfer không tính vào chi tiêu.
- [ ] Báo cáo tháng/danh mục đúng.
- [ ] Không xem/sửa được dữ liệu của user khác (có test).

### AI
- [ ] Gemini chỉ gọi từ backend; key không có trong frontend/repo.
- [ ] AI không tự thay đổi dữ liệu khi chưa xác nhận.
- [ ] Có rate limit và xử lý lỗi/timeout provider.

### Release
- [ ] Deploy thành công trên Vercel + Render + Supabase, chi phí 0đ.
- [ ] CI chạy test/lint trên mỗi push.
- [ ] Không commit secret; có `.env.example`.
- [ ] Có workflow backup database.

---

## 15. Để sau (v2+)
Habits & Goals · Fitness (workout, sets, body measurements) · Nutrition (food diary, meal plans, macro) · Savings goals · Recurring transactions tự động · Import CSV · Google Calendar sync · Push notifications · Nhận diện món ăn bằng ảnh · Widget dashboard tùy chỉnh · Đa tiền tệ · Gamification · Trả góp theo từng món cho tài khoản trả sau (tự chia kỳ, "Cần trả" = tổng các kỳ đến hạn; **chờ người dùng xác nhận quy tắc kỳ đầu / ngày chốt sao kê**).

### 15.1. Nutrition + Food scan (Phase 10 — làm đầu tiên sau MVP)
Làm sau Phase 8 vì tái sử dụng Gemini client, rate limit và `ai_action_proposals`.

- **Chụp ảnh:** `<input type="file" accept="image/*" capture="environment">` (camera native, không thêm thư viện). Resize/nén phía client (~1024px, JPEG) trước khi gửi.
- **API:** `POST /api/v1/ai/food-scan` (multipart). Laravel gửi ảnh cho Gemini (vision) với structured output (JSON schema): danh sách món, khẩu phần ước tính (g), độ tin cậy.
- **Calo theo hướng lai:** AI chỉ **nhận diện món + ước lượng khẩu phần**; kcal/macro lấy từ bảng `foods` (seed món Việt phổ biến theo khẩu phần chuẩn). Món không có trong bảng → dùng số Gemini ước tính, gắn nhãn "ước tính". Lý do: AI đoán khẩu phần và dầu mỡ sai lệch lớn (20–40%), số từ bảng ổn định hơn.
- **Xác nhận:** kết quả tạo `ai_action_proposals`; người dùng sửa món/khẩu phần rồi mới ghi `food_entries` (có nutrition snapshot). AI không tự ghi.
- **Ảnh không lưu:** xử lý trong bộ nhớ rồi bỏ (Render không có disk; không cần Supabase Storage).
- **Ràng buộc:** chỉ online; rate limit theo user/ngày (free tier Gemini giới hạn request); thông báo cho người dùng rằng ảnh được gửi tới Google Gemini (free tier có thể dùng dữ liệu để cải thiện sản phẩm).
- **Tiêu chí nghiệm thu:** quét được món Việt phổ biến; người dùng sửa được trước khi lưu; lỗi/timeout/vượt quota hiển thị thân thiện; không lưu ảnh; có test ownership cho `food_entries`.

---

## 16. Hướng dẫn cho AI assistant

Đóng vai **Senior Full-stack Engineer kiêm UI/UX Engineer**, hướng dẫn và viết code cho LIFEHUB theo spec này.

### Bối cảnh người làm
- Sinh viên IT năm cuối, đã có kinh nghiệm frontend/full-stack web, **mới làm quen PostgreSQL và Docker**, còn mơ hồ về kiến trúc frontend React lớn.
- Làm bán thời gian. Ưu tiên giải thích ngắn gọn *tại sao* bên cạnh *làm thế nào*.

### Quy tắc
1. **Làm theo từng phase** ở mục 13. Không sinh toàn bộ hệ thống một lần.
2. Mỗi phase: nêu kế hoạch ngắn → danh sách file tạo/sửa → code đầy đủ (không placeholder kiểu `// ...rest`) → lệnh để chạy/kiểm tra → kết quả mong đợi.
3. Mỗi tính năng là một **vertical slice**: migration + model + policy + request + resource + controller/service + route + test + UI.
4. **Chỉ dùng dịch vụ miễn phí**. Nếu một giải pháp cần trả phí, nói rõ và đưa phương án free.
5. Tôn trọng các ràng buộc hạ tầng ở mục 3 (không worker nền, không disk, pooler Supabase, cold start).
6. Mọi dữ liệu cá nhân giới hạn theo user đã xác thực; validate ở backend.
7. Gemini chỉ gọi từ Laravel; AI không tự ghi dữ liệu.
8. Không hardcode số liệu giả vào dashboard; seed demo phải gắn nhãn demo.
9. Ưu tiên giải pháp đơn giản, dễ bảo trì; tránh abstraction thừa; controller mỏng.
10. Khi có nhiều lựa chọn kỹ thuật, đưa tối đa 2 phương án, khuyến nghị 1 và giải thích ngắn.
11. Không khẳng định "đã chạy được" — đưa lệnh để người làm tự chạy và mô tả output mong đợi; khi người làm dán lỗi, đọc kỹ và sửa tận gốc.
12. Phiên bản thư viện: dùng bản ổn định mới nhất; nếu không chắc cú pháp của phiên bản mới, nói rõ và hướng dẫn kiểm tra docs.

### Definition of Done mỗi phase
- Chạy được local (Docker) và không làm hỏng bản deploy.
- Migration/seeder đầy đủ, chạy lặp được.
- Validation + authorization có mặt.
- UI có loading/error/empty/offline khi liên quan.
- Có test cho luồng chính.
- Không secret trong repo; README/`.env.example` cập nhật.

### Bắt đầu
Bắt đầu từ **Phase 1 — Foundation**: đề xuất cấu trúc monorepo, `docker-compose.yml`, Dockerfile dev cho Laravel, cấu hình `pgsql`, khởi tạo Vite + React + TS + Tailwind + shadcn/ui với design tokens ở mục 7, và README hướng dẫn chạy.

### 15.2. Nhắc hạn chót bằng Web Push (Phase 11)
Trong lúc chưa có, Dashboard (Phase 8) hiển thị việc sắp đến hạn / quá hạn mỗi khi mở app.

- **Quy tắc nhắc:** task chưa xong (`todo`, `in_progress`) có `due_at` trong **3 ngày tới**, nhắc **2 lần/ngày lúc 08:00 và 20:00** theo timezone của user. Mỗi lần gửi **1 thông báo gộp** ("Bạn có 3 việc sắp đến hạn: …"), không gửi từng task.
- **Đăng ký:** Settings có công tắc "Nhắc hạn chót" → xin quyền Notification → lưu push subscription (bảng `push_subscriptions`: user_id, endpoint unique, keys, user_agent, timestamps). Tắt công tắc hoặc logout → xoá subscription của thiết bị đó.
- **Gửi:** GitHub Actions cron gọi `POST /api/internal/reminders` bảo vệ bằng secret header (không có worker nền trên Render, mục 3). Backend gửi qua `minishlink/web-push` với VAPID key (lưu trong env Render, không commit). Subscription trả 404/410 → xoá.
- **Frontend:** chuyển `vite-plugin-pwa` sang `injectManifest` để có service worker tự viết xử lý `push` và `notificationclick` (mở `/app/tasks?view=upcoming`).
- **Giới hạn:** iOS chỉ nhận push khi đã cài PWA vào màn hình chính (iOS 16.4+). GitHub cron có thể trễ 5–30 phút hoặc bỏ lượt khi quá tải.
- **Tiêu chí nghiệm thu:** bật/tắt được; nhận đúng 1 thông báo gộp mỗi lượt; không gửi cho task đã xong/huỷ; endpoint cron từ chối khi thiếu secret; có test cho truy vấn chọn task và cho xác thực secret.

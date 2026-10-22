# LIFEHUB

Personal Life OS: quản lý lịch, công việc, tài chính kèm AI Coach. PWA cài được, hỗ trợ offline. Spec: [`docs/LIFEHUB_Project_Specification_v1.1.md`](docs/LIFEHUB_Project_Specification_v1.1.md).

## Yêu cầu

- PHP 8.3 + Composer (bật `pdo_pgsql`)
- Node 24+
- Docker Desktop

## Chạy local

**Windows (nhanh):** bấm đúp `dev.bat`. File này bật Postgres, mở 2 cửa sổ backend và frontend, rồi mở trình duyệt. Muốn tắt thì đóng 2 cửa sổ đó. Cần chạy các bước cài đặt bên dưới một lần trước.

```sh
# 1. Database (Postgres 16, host port 5433)
docker compose up -d db

# 2. Backend → http://localhost:8000
cd backend
composer install
cp .env.example .env        # đã trỏ sẵn Postgres Docker (port 5433)
php artisan key:generate
php artisan migrate
php artisan serve

# 3. Frontend → http://localhost:5173
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Quên mật khẩu ở local: email không gửi thật (`MAIL_MAILER=log`), link đặt lại nằm trong `backend/storage/logs/laravel.log`.

## Kiểm tra PWA

Service worker chỉ chạy trên bản build:

```sh
cd frontend
npm run build && npm run preview   # http://localhost:4173
```

DevTools → Application → Manifest/Service workers; Network → Offline rồi reload để thấy app shell vẫn mở.

## Thử image production của backend

```sh
docker compose --profile app up --build   # http://localhost:8080/api/health
```

Dùng đúng `backend/Dockerfile` như trên Render, nối với Postgres local.

## Deploy (miễn phí)

Thứ tự: Supabase → Render → Vercel → quay lại Render sửa `FRONTEND_URL`.

### 1. Supabase (database)
1. [supabase.com](https://supabase.com) → New project. Region **Southeast Asia (Singapore)**.
2. Database password: chỉ dùng chữ và số (ký tự đặc biệt phải URL-encode trong connection string). Lưu vào trình quản lý mật khẩu.
3. Nút **Connect** → **Session pooler** → copy URI (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`), thay `[YOUR-PASSWORD]`.

### 2. Render (backend)
1. [render.com](https://render.com) → New → **Web Service** → chọn repo này.
2. Root Directory `backend`, Language **Docker**, Region **Singapore**, Instance **Free**.
3. Health Check Path: `/api/health`.
4. Environment variables:

| Key | Value |
|---|---|
| `APP_KEY` | chạy `php artisan key:generate --show` trong `backend/` |
| `APP_URL` | `https://<tên-service>.onrender.com` |
| `FRONTEND_URL` | tạm để `http://localhost:5173`, sửa sau bước 3 |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` | URI Session pooler ở bước 1 |
| `DB_SSLMODE` | `require` |

Mail (tùy chọn, cần cho quên mật khẩu): tạo tài khoản [Brevo](https://brevo.com), xác thực địa chỉ gửi, lấy SMTP key → thêm `MAIL_MAILER=smtp`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=587`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`.

Deploy xong, mở `https://<tên-service>.onrender.com/api/health` → `{"status":"ok"}`. Migration tự chạy khi container khởi động.

### 3. Vercel (frontend)
1. [vercel.com](https://vercel.com) → Add New → Project → chọn repo này.
2. Root Directory `frontend` (Vercel tự nhận Vite).
3. Environment variable `VITE_API_URL` = `https://<tên-service>.onrender.com/api/v1`.
4. Deploy, rồi quay lại Render đổi `FRONTEND_URL` thành domain Vercel (`https://<project>.vercel.app`, không có `/` cuối).

### 4. Keepalive
GitHub repo → Settings → Secrets and variables → Actions → **Variables** → thêm `API_HEALTH_URL` = `https://<tên-service>.onrender.com/api/health`. Workflow `keepalive.yml` ping mỗi ngày để Supabase không bị pause.

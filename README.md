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

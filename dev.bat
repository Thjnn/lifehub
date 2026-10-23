@echo off
rem Local dev launcher: Postgres (Docker) + Laravel + Vite, then opens the app.
rem Temporary: replaced by `docker compose up` once Laravel runs in Docker (Phase 3).
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Laragon's PHP is often not on PATH outside its terminal: use the newest php-8.3* under Laragon.
where php >nul 2>nul || for /d %%D in ("%~dp0..\..\bin\php\php-8.3*") do set "PATH=%%~fD;%PATH%"
where php >nul 2>nul || (echo Không tìm thấy PHP. Mở bằng Terminal của Laragon hoặc thêm PHP vào PATH. & pause & exit /b 1)

rem Web Push encrypts each notification with a fresh OpenSSL key; Windows PHP can't create keys unless
rem OPENSSL_CONF points at its openssl.cnf. It must be set before PHP starts (the backend window inherits it).
if not defined OPENSSL_CONF for /f "delims=" %%P in ('where php') do if not defined OPENSSL_CONF if exist "%%~dpPextras\ssl\openssl.cnf" set "OPENSSL_CONF=%%~dpPextras\ssl\openssl.cnf"

echo Khởi động Postgres (Docker)...
docker compose up -d db || (echo Docker Desktop chưa chạy? Mở Docker Desktop rồi chạy lại. & pause & exit /b 1)

start "LIFEHUB backend :8000" /d "%~dp0backend" cmd /k php artisan serve
start "LIFEHUB frontend :5173" /d "%~dp0frontend" cmd /k npm run dev

rem Give Vite a moment before opening the browser.
timeout /t 4 /nobreak >nul
start "" http://localhost:5173

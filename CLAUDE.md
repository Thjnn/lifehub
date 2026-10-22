# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LIFEHUB — personal life management PWA (tasks, calendar, finance, AI briefing). The full spec is `docs/LIFEHUB_Project_Specification_v1.1.md` (Vietnamese) and is the source of truth for scope, schema, API, routes and design tokens — read the relevant section before building a feature. Respond to the user in Vietnamese.

Monorepo: `backend/` (Laravel 13, PHP 8.3, REST API under `/api/v1`) and `frontend/` (React 19 + TS + Vite 8 PWA). Deployed independently: frontend → Vercel, backend → Render (Docker), DB → Supabase Postgres. Everything must stay on free tiers.

## Local environment (Windows)

- Laragon provides PHP 8.3 (with `pdo_pgsql`); Laravel runs **on the host**, not in Docker. `php`/`composer` are not on PATH in Claude's shells — use `/e/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php` and `/e/laragon/bin/composer/composer.phar`. Laravel-in-Docker + `backend/Dockerfile` are deferred to Phase 3.
- `dev.bat` starts Postgres + `php artisan serve` + `npm run dev` for daily work. `docker compose --profile app up --build` runs the **production** backend image (FrankenPHP, port 8080) against local Postgres — use it to verify Dockerfile/entrypoint changes before they hit Render.
- Postgres runs in Docker (`docker-compose.yml`, service `db`, container `lifehub-db`). Host port is **5433** because 5432 is taken by a Windows Postgres install. `backend/.env` points at `pgsql 127.0.0.1:5433`, db/user `lifehub`, password `secret`.
- `backend/.env.example` still has the Laravel default `DB_CONNECTION=sqlite` — update it when touching env config.
- `backend/CLAUDE.md` / `backend/AGENTS.md` are the Laravel Boost bootstrap stub (Boost is not installed). Don't install Boost unless the user asks.

## Commands

```sh
docker compose up -d db                 # start Postgres (repo root)

# backend/
php artisan serve                       # API at http://localhost:8000
php artisan migrate                     # against Docker Postgres
composer test                           # config:clear + full test suite (SQLite in-memory)
# same suite on Postgres (create the db once: docker exec lifehub-db psql -U lifehub -c "create database lifehub_test")
DB_CONNECTION=pgsql DB_DATABASE=lifehub_test DB_PORT=5433 vendor/bin/phpunit
php artisan test --filter=SomeTest      # single test class/method
vendor/bin/pint                         # format (Laravel Pint)

# frontend/
npm run dev                             # http://localhost:5173 (service worker disabled in dev)
npm run lint                            # oxlint (not ESLint)
npm test                                # vitest (jsdom); single file: npx vitest run src/lib/api-client.test.ts
npm run build                           # tsc -b + vite build + generates sw.js
npm run preview                         # test PWA install/offline against the build
npm run generate-pwa-assets             # regenerate public/icons/* from public/icons/logo.svg
npx shadcn@latest add <component>       # shadcn/ui (radix base, Tailwind v4)
```

Smoke test after each Vercel production deploy (`.github/workflows/smoke.yml`, script `.github/scripts/smoke-frontend.sh <url>`, also runnable locally): deep links serve HTML, the current CSS is text/css, **a missing /assets file must 404** (never index.html — that broke phones once), sw.js not cached.

CI (`.github/workflows/ci.yml`) runs frontend lint + build and backend Pint `--test` + `composer test` on every push.

Tests run on **SQLite in-memory** (`backend/phpunit.xml`), not Postgres. Postgres-specific behavior (CHECK constraints, `TIMESTAMPTZ`, `JSONB`, `NUMERIC` precision) is not exercised by default — when a test depends on it, point it at Postgres explicitly.

## Architecture rules (from spec)

- **Modular monolith.** Thin controllers in `app/Http/Controllers/Api/V1/`; Form Requests for validation, Policies for authorization, API Resources for output (`{ data, meta }`), domain logic in `app/Services/{Planning,Finance,Ai}/` or `app/Actions/`.
- **Auth:** Sanctum personal access tokens (Bearer), not SPA cookies — frontend and backend are cross-site. Tokens expire after 30 days (`config/sanctum.php`); password reset revokes all tokens. CORS and reset-email links both use `FRONTEND_URL` (`config('app.frontend_url')`). Auth routes are `throttle:6,1`. A `user_settings` row is created by the `User::created` hook (so seeders must not use `WithoutModelEvents`).
- **Frontend auth flow:** `src/lib/api-client.ts` (`api()` fetch wrapper, `tokenStore`, `ApiError`, slow-request tracking for the "waking server" banner). Route guards are React Router loaders in `src/app/router.tsx` (`requireAuth` uses `queryClient.ensureQueryData(meQuery)`); mid-session 401s are handled in the `QueryCache` `onError` in `src/app/query-client.ts`. Forms: React Hook Form + Zod via the local `zodResolver` in `src/lib/form.ts` (`@hookform/resolvers` currently fails to install due to an upstream peer conflict) and `applyServerErrors` to map Laravel 422s onto fields.
- **Ownership:** every query scoped to `auth()->id()`; never trust IDs from the client; Policies on every resource, with tests proving users can't see each other's data.
- **Deploy:** live at https://lifehub-frontend-mu.vercel.app (Vercel project `lifehub-frontend`, team `thjn`) and https://lifehub-epzt.onrender.com (Render, Singapore; Supabase Singapore via Session pooler). Pushing to `main` auto-deploys both. Setup steps: README "Deploy" section. Backend image = `backend/Dockerfile` (FrankenPHP; `docker/entrypoint.sh` sets `SERVER_NAME=:$PORT`, caches config/routes, runs `migrate --force`). Frontend on Vercel via `frontend/vercel.json` (SPA rewrite, CSP — `connect-src` must allow the API origin, sw.js not cached). `.github/workflows/keepalive.yml` pings `vars.API_HEALTH_URL` daily.
- **Render free-tier constraints:** no queue worker or scheduler (`QUEUE_CONNECTION=sync`; periodic jobs = GitHub Actions cron hitting a secret-protected endpoint), no persistent disk (log to stderr, files to Supabase Storage), cold starts of 30–60s. Supabase via Supavisor pooler, `sslmode=require`.
- **Schema conventions:** `timestampTz` (UTC), money `NUMERIC(15,2)`, enums as `VARCHAR` + CHECK / PHP enums (no native Postgres enums), `JSONB` for JSON. `tasks` and `transactions` use **client-generated UUID** PKs with soft deletes and are written via idempotent `PUT /{uuid}` upserts (offline outbox sync).
- **Planning:** tasks use client UUID + idempotent `PUT /tasks/{uuid}` (409 if the task was soft-deleted). Datetimes go through `App\Casts\UtcDateTime` (the built-in cast drops the offset) and query params must be `->utc()`'d before binding. Events: recurring series are stored once (`recurrence_rule` = RRULE without DTSTART) and expanded per request by `App\Services\Planning\EventOccurrences` **in the user's timezone** (BYDAY is weekday-sensitive); the same service powers overlap warnings (`meta.overlaps`, never blocking). Editing/deleting a recurring event affects the whole series. Frontend calendar = FullCalendar **v6** (keep all `@fullcalendar/*` on the same major; v7 changed packaging), lazy-loaded route, themed via `.fc.fc` vars in `index.css`.
- **Finance:** MVP is VND only. A transfer is one row (`account_id` → `to_account_id`, no category) and never counts as income/expense. Balance = `opening_balance + income − expense − transfer_out + transfer_in`, computed by SQL aggregate. Money is **never a float**: API returns decimal strings (`App\Support\Money::format`, bcmath), frontend displays via `lib/money.ts` and adds with BigInt cents (`sumMoney`); UI input is whole VND. System categories (user_id null, read-only) are inserted **in the categories migration** because Render only runs `migrate`. Transaction requests must validate account/category ownership (`Rule::exists(...)->where(user_id)`); accounts/categories in use are hidden/renamed, not deleted (409). Month-based queries go through `App\Services\Finance\MonthRange` (user-timezone month → UTC range); aggregates live in `FinanceReport` (transfers never count as income/expense). Budgets are monthly; uniqueness uses Postgres `UNIQUE NULLS NOT DISTINCT` so only one overall (category_id null) budget per month. **Debts / BNPL** are accounts (`liability` = I owe, negative balance; `receivable` = owed to me): a BNPL purchase is an expense from the liability (spending counted once), an instalment is a transfer into it. Schedules (`due_date` once or `due_day` monthly, clamped to short months) are expanded by `App\Services\Finance\DebtSchedule` (`GET /debts/due`); Phase 12 push reminders should reuse it. Charts follow the dataviz skill: stat tiles + plain HTML bars/meters (no chart library yet).
- **AI:** Gemini is called only from Laravel, rate-limited per user. AI never writes data directly — it creates `ai_action_proposals` the user must confirm. Code: `app/Services/Ai` — `Gemini` (REST generateContent + function calling; model from `GEMINI_MODEL`, default Flash-Lite because the free tier of Flash is only ~20 requests/day; on 429 (quotas are per model) or 500/503 (retried once) it falls back to `GEMINI_FALLBACK_MODEL`; failures throw `AiUnavailable` → friendly 503, logged as a warning only. **Known limit:** when both free quotas are exhausted the Coach is down until Google's daily reset — accepted, not worked around), `AiTools` (read-only functions scoped to the user returning aggregates, plus `propose_task`/`propose_event`; **no transaction tools**; tool errors are returned to the model and logged), `Coach` (chat loop ≤4 tool rounds, daily briefing cached in `ai_daily_briefings`). Limits: 30 chats / 3 briefing refreshes per user per 24h. Tests fake Gemini with `Http::fake`. Frontend renders AI text via `features/ai/ai-text.ts` (no innerHTML). Weather: the dashboard and city search call Open-Meteo **from the browser** (`features/dashboard/open-meteo.ts`, CSP allows both Open-Meteo hosts) — from Render the shared IP hits Open-Meteo's per-IP daily quota (429). `App\Services\Weather\OpenMeteo` only feeds the AI Coach (cached 1h, null on failure). Dashboard: one `GET /dashboard` call.
- **Frontend:** React Router v8 data mode (`src/app/router.tsx`); each route's `handle.title` drives the topbar/document title. `src/lib/nav.ts` is the single nav list feeding Sidebar (desktop), BottomNav (first 4 items + "Thêm" sheet on mobile) and SectionNav (sub-tabs for items with `children`). Design tokens (spec §7) are CSS variables in `src/index.css` mapped onto shadcn's names, plus `success`/`warning`; dark only (`<html class="dark">`). `--primary-foreground` is dark on purpose — white on `#5B8CFF` fails WCAG AA. Feature code goes in `src/features/<name>/`.
- **Offline:** level 1 app-shell precache (`vite-plugin-pwa`, `registerType: 'prompt'`). Level 2 done: `src/app/query-client.ts` persists the TanStack cache to IndexedDB (`idb-keyval`, 7-day `maxAge`, `gcTime` must stay >= it); `main.tsx` awaits `restoreOfflineCache()` before rendering so loaders see cached data, and `requireAuth` skips the network when `navigator.onLine` is false. `clearOfflineData()` runs on logout **and** on sign-in (never show a previous user's data). Level 3 done: `src/offline/` — Dexie `outbox`, `saveOrQueue()` (online → direct PUT so 422s reach the form; no connection → queue; a record already queued stays queued to keep order), `syncOutbox()` replays in order (network/5xx/401/429 stop and retry later; other 4xx → kept as failed, never dropped), coalesces edits per record, and task payloads carry `client_updated_at` for last-write-wins (409 → user can overwrite). Offline-capable writes: task create/edit/complete, transaction create; deletes and transaction edits are online-only. Mutations use `networkMode: 'always'` (TanStack would otherwise pause them offline). Tests need `fake-indexeddb` (vitest setupFiles) and must not fake setImmediate. Workbox must not cache API GETs. Install prompt: `src/hooks/use-install-prompt.ts` (+ iOS instructions sheet).
- **Notes (Phase 10):** `notes` mirrors tasks — client UUID, `PUT /notes/{uuid}` upsert with last-write-wins (`client_updated_at`), soft deletes, offline via the outbox (`entity: 'note'`). Optional `task_id`/`event_id` links (validated as the user's own, `nullOnDelete`). `GET /notes` returns the first 100 (pinned, then recently edited); **search and the per-task/event lists filter that cached list on the client** (`matchesSearch` folds case + Vietnamese diacritics) so they work offline. UI: `features/notes/` (`NotesPage`, `NoteFormSheet`, `LinkedNotes` under the task/event edit sheets).
- **Nutrition (Phase 11a):** `NutritionController` — profile (`nutrition_profiles`, one per user) → targets by `AppServicesNutritionNutritionTargets` (Mifflin-St Jeor × activity from workouts/week, goal cut ×0.85 / bulk ×1.1, protein g/kg; **never AI**). `foods` = ~40 Vietnamese dishes per serving, inserted **in the migration** (read-only, sent whole and searched on the client). `food_entries` store a **nutrition snapshot**; for a table dish the server scales by grams (client numbers ignored), manual entries carry the user's numbers. Day list = user-timezone day + totals + targets. Online-only. Next: 11b food scan (Gemini vision → proposal → confirm), 11c AI weekly meal plan within the food budget, 11d workouts.
- **Avatar:** `users.avatar` = data URL (raster only, validated by regex in `ProfileController`), made in the browser by `features/settings/avatar.ts` (256px center crop, WebP else JPEG). Stored in Postgres because Render has no disk and the image is ~10–20 KB; shown via `components/shared/UserAvatar`. CSP `img-src` allows `data:`.
- **Privacy & ops:** `PrivacyController` — `GET /privacy/export` (raw rows of every user-owned table as a JSON download) and `DELETE /me` (password required; deletes transactions first because they `restrictOnDelete` accounts/categories, then Sanctum tokens, which have no FK, then the user — the rest cascades). **New user-owned tables must be added to `PrivacyController::TABLES`.** Backups: `.github/workflows/backup.yml` (weekly `pg_dump` in `postgres:17`, gpg-encrypted because the repo is public; secrets `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`). API docs: `dedoc/scramble` (dev only; `/docs/api` locally, not installed in production) exported to `docs/openapi.json` — re-export after API changes. Caddy admin API is off (`CADDY_GLOBAL_OPTIONS`).

## Working rules (spec §16)

The user is a final-year IT student, new to PostgreSQL and Docker, working part-time. Explain *why* briefly alongside *how*.

1. Work **phase by phase** (spec §13). Never generate the whole system at once.
2. Per phase: short plan → list of files to create/modify → complete code (no `// ...rest` placeholders) → commands to run → expected output. Present the plan for approval before coding.
3. Each feature is a **vertical slice**: migration + model + policy + request + resource + controller/service + route + test + UI.
4. Free services only; if something costs money, say so and offer a free alternative.
5. Respect the infra constraints above (no background worker, no disk, Supabase pooler, cold start).
6. All personal data scoped to the authenticated user; validate on the backend.
7. Gemini only from Laravel; AI never writes data on its own.
8. No hardcoded fake numbers on the dashboard; demo seed data must be labeled as demo.
9. Prefer simple, maintainable solutions; no unnecessary abstraction; thin controllers.
10. When there are multiple technical options, give at most 2, recommend 1, explain briefly.
11. Don't claim "it works" — give the commands for the user to run and describe expected output; when the user pastes an error, read it carefully and fix the root cause.
12. Use the latest stable library versions; if unsure about new-version syntax, say so and point to the docs.

**Definition of Done per phase:** runs locally and doesn't break deploy; migrations/seeders complete and re-runnable; validation + authorization present; UI has loading/error/empty/offline states where relevant; tests for the main flow; no secrets in repo; README / `.env.example` updated.

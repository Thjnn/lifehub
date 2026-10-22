# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LIFEHUB — personal life management PWA (tasks, calendar, finance, AI briefing). The full spec is `docs/LIFEHUB_Project_Specification_v1.1.md` (Vietnamese) and is the source of truth for scope, schema, API, routes and design tokens — read the relevant section before building a feature. Respond to the user in Vietnamese.

Monorepo: `backend/` (Laravel 13, PHP 8.3, REST API under `/api/v1`) and `frontend/` (React 19 + TS + Vite 8 PWA). Deployed independently: frontend → Vercel, backend → Render (Docker), DB → Supabase Postgres. Everything must stay on free tiers.

## Local environment (Windows)

- Laragon provides PHP 8.3 (with `pdo_pgsql`); Laravel runs **on the host**, not in Docker. `php`/`composer` are not on PATH in Claude's shells — use `/e/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php` and `/e/laragon/bin/composer/composer.phar`. Laravel-in-Docker + `backend/Dockerfile` are deferred to Phase 3.
- Only Postgres runs in Docker (`docker-compose.yml`, service `db`, container `lifehub-db`). Host port is **5433** because 5432 is taken by a Windows Postgres install. `backend/.env` points at `pgsql 127.0.0.1:5433`, db/user `lifehub`, password `secret`.
- `backend/.env.example` still has the Laravel default `DB_CONNECTION=sqlite` — update it when touching env config.
- `backend/CLAUDE.md` / `backend/AGENTS.md` are the Laravel Boost bootstrap stub (Boost is not installed). Don't install Boost unless the user asks.

## Commands

```sh
docker compose up -d db                 # start Postgres (repo root)

# backend/
php artisan serve                       # API at http://localhost:8000
php artisan migrate                     # against Docker Postgres
composer test                           # config:clear + full test suite
php artisan test --filter=SomeTest      # single test class/method
vendor/bin/pint                         # format (Laravel Pint)

# frontend/
npm run dev                             # http://localhost:5173 (service worker disabled in dev)
npm run lint                            # oxlint (not ESLint)
npm run build                           # tsc -b + vite build + generates sw.js
npm run preview                         # test PWA install/offline against the build
npm run generate-pwa-assets             # regenerate public/icons/* from public/icons/logo.svg
npx shadcn@latest add <component>       # shadcn/ui (radix base, Tailwind v4)
```

CI (`.github/workflows/ci.yml`) runs frontend lint + build and backend Pint `--test` + `composer test` on every push.

Tests run on **SQLite in-memory** (`backend/phpunit.xml`), not Postgres. Postgres-specific behavior (CHECK constraints, `TIMESTAMPTZ`, `JSONB`, `NUMERIC` precision) is not exercised by default — when a test depends on it, point it at Postgres explicitly.

## Architecture rules (from spec)

- **Modular monolith.** Thin controllers in `app/Http/Controllers/Api/V1/`; Form Requests for validation, Policies for authorization, API Resources for output (`{ data, meta }`), domain logic in `app/Services/{Planning,Finance,Ai}/` or `app/Actions/`.
- **Auth:** Sanctum personal access tokens (Bearer), not SPA cookies — frontend and backend are cross-site. CORS allows only the Vercel origin + `localhost:5173`.
- **Ownership:** every query scoped to `auth()->id()`; never trust IDs from the client; Policies on every resource, with tests proving users can't see each other's data.
- **Render free-tier constraints:** no queue worker or scheduler (`QUEUE_CONNECTION=sync`; periodic jobs = GitHub Actions cron hitting a secret-protected endpoint), no persistent disk (log to stderr, files to Supabase Storage), cold starts of 30–60s. Supabase via Supavisor pooler, `sslmode=require`.
- **Schema conventions:** `timestampTz` (UTC), money `NUMERIC(15,2)`, enums as `VARCHAR` + CHECK / PHP enums (no native Postgres enums), `JSONB` for JSON. `tasks` and `transactions` use **client-generated UUID** PKs with soft deletes and are written via idempotent `PUT /{uuid}` upserts (offline outbox sync).
- **Finance:** MVP is VND only. A transfer is one row (`account_id` → `to_account_id`, no category) and never counts as income/expense. Balance = `opening_balance + income − expense − transfer_out + transfer_in`, computed by SQL aggregate.
- **AI:** Gemini is called only from Laravel, rate-limited per user. AI never writes data directly — it creates `ai_action_proposals` the user must confirm.
- **Frontend:** React Router v8 data mode (`src/app/router.tsx`); each route's `handle.title` drives the topbar/document title. `src/lib/nav.ts` is the single nav list feeding Sidebar (desktop), BottomNav (first 4 items + "Thêm" sheet on mobile) and SectionNav (sub-tabs for items with `children`). Design tokens (spec §7) are CSS variables in `src/index.css` mapped onto shadcn's names, plus `success`/`warning`; dark only (`<html class="dark">`). `--primary-foreground` is dark on purpose — white on `#5B8CFF` fails WCAG AA. Feature code goes in `src/features/<name>/`; unbuilt routes render `ComingSoon`.
- **Offline plan:** app shell precache (done, `vite-plugin-pwa` with `registerType: 'prompt'`), TanStack Query persisted to IndexedDB (Phase 4), Dexie outbox for Task/Transaction writes only (Phase 7). Workbox must not cache API GETs. Logout clears all offline caches.

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

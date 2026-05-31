# TradeIn — Grade Price Comparison Platform

Compare mobile trade-in grade prices across **Dynamica**, **Partner**, **KSP**, and **Pelephone** in one dashboard with a tier-grouped summary table.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind, Supabase Auth |
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL (Docker) |
| Auth | Supabase local (JWT verified by backend) |

## Prerequisites

- **Docker Desktop** — for Postgres (`docker compose up -d`)
- **Python 3.11+**
- **Node.js 20+**
- **Supabase CLI** — `brew install supabase/tap/supabase`
- **Playwright** (optional) — `playwright install chromium` only if you need browser-based scraping elsewhere

## Quick start

### 1. Environment

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

Edit `.env` after `supabase start` (step 3) to paste JWT secret and anon key.

### 2. Database (app data)

```bash
docker compose up -d
```

Postgres runs on **localhost:5433** with schema from `supabase/migrations/001_init.sql`.

### 3. Supabase Auth (local)

```bash
supabase start
```

Copy from the output into `.env`:

- `SUPABASE_JWT_SECRET` → `JWT secret`
- `SUPABASE_ANON_KEY` → `anon key`

Copy into `frontend/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`

Create admin user in [Supabase Studio](http://127.0.0.1:54323) or:

```bash
chmod +x scripts/create_admin_user.sh
./scripts/create_admin_user.sh tomerbardao@tradein.local YourPassword
```

Ensure the email is listed in `ADMIN_EMAILS` in `.env`.

### 4. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
pytest
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

## Company grade columns

| Company | Source | Grade labels (Hebrew) |
|---------|--------|----------------------|
| Dynamica | Excel upload | A תקין, B תקין, C שבור/סדוק, D תקול |
| Partner | Excel upload | תקין |
| KSP | Scraper (API) | כחדש לחלוטין, ללא שבר/סדק, שבר/סדק, תקול |
| Pelephone | Scraper (HTTP API) | תקין, תקין חלקית, תקול |

## Summary table

The summary view groups prices by **condition tier** (1–4), not as a flat 12-column row. Partner appears only in Tier 1. Empty cells mean no grade at that tier.

## Admin features

- **Upload** — Excel import for Dynamica and Partner (`/admin/upload`)
- **Scrape** — Trigger KSP API scrape or Pelephone TradeSearch API scrape (`/admin/scrape`)

All authenticated users can view tables and download Excel exports.

## Normalized device names

| Brand | Format | Example |
|-------|--------|---------|
| Apple | `iPhone {model} {storage}GB` | `iPhone 14 Pro Max 128GB` |
| Samsung | `Samsung Galaxy {model} {storage}GB` | `Samsung Galaxy A72 256GB` |

Strips Hebrew prefixes, colors, `(2019)` years, and normalizes storage spacing.

## Project structure

```
TradeIn/
├── backend/           # FastAPI API + scrapers
├── frontend/          # Next.js UI
├── supabase/          # Migrations + config.toml
├── docker-compose.yml # Postgres for app data
└── .env.example
```

## Tests

```bash
cd backend && source .venv/bin/activate && pytest
```

Covers normalizer, KSP parser, and Pelephone HTML parser.

## Deploy online (Supabase + Render + Vercel)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for step-by-step production setup:

- **Supabase Cloud** — auth + Postgres (run `supabase/migrations/001_init.sql`)
- **Render** — FastAPI backend (`render.yaml` + `backend/Dockerfile`)
- **Vercel** — Next.js frontend (root: `frontend/`)

Copy env templates from `.env.production.example` and `frontend/.env.local.example`.

## Notes

- App Postgres (`:5433`) and Supabase Auth Postgres (`:54322`) are separate in local dev.
- Pelephone uses `RepairServicesApi/TradeSearch` (embedded catalog + JSON POST). If it breaks, check `backend/app/scrapers/companies/pelephone.py`.
- Do not commit `.env` or passwords.

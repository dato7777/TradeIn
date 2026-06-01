# Production deployment — Supabase + Render + Vercel

Deploy **RES PARTS** with:

| Service | Hosts |
|---------|--------|
| **Supabase Cloud** | Auth (login) + PostgreSQL (app data) |
| **Render** | FastAPI backend (`/api/*`, scrapers, Excel import) |
| **Vercel** | Next.js frontend |

```
Browser → Vercel (Next.js)
              ↓ Supabase Auth JWT
              ↓ API calls
         Render (FastAPI) → Supabase Postgres
              ↓ JWKS verify
         Supabase Auth
```

---

## 1. Supabase Cloud project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Settings → API** — copy:
   - **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **JWT Secret** → `SUPABASE_JWT_SECRET` (Render only; optional fallback for HS256)
3. **Settings → Database → Connection string → URI** (Session mode):
   - Copy the URI → `DATABASE_URL` on Render  
   - Must include SSL, e.g. `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require`
4. **SQL Editor** — run the full contents of `supabase/migrations/001_init.sql` (creates tables + seeds companies).

### Auth URLs (after you know your Vercel URL)

**Authentication → URL configuration:**

| Field | Value |
|-------|--------|
| Site URL | `https://your-app.vercel.app` |
| Redirect URLs | `https://your-app.vercel.app/**` |

For local dev, keep `http://localhost:3000` in redirect URLs as well.

### Create admin user

**Authentication → Users → Add user** (email + password).

Add that email to `ADMIN_EMAILS` on Render (comma-separated for multiple admins).

---

## 2. Render (backend)

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New → Blueprint** → connect repo.
3. Set environment variables when prompted:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres URI (`?sslmode=require`) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase |
| `CORS_ORIGINS` | `https://your-app.vercel.app` |
| `ADMIN_EMAILS` | `admin@yourcompany.com` |

4. Deploy. Note the service URL, e.g. `https://resparts-api.onrender.com`.

### Option B — Manual Web Service

1. **New → Web Service** → connect repo.
2. **Root directory:** `backend`
3. **Runtime:** Docker (uses `backend/Dockerfile`)
4. **Health check path:** `/health`
5. Add the same env vars as above.

### Free tier note

Render free services spin down after inactivity (~50s cold start on first request). Upgrade to Starter for always-on.

---

## 3. Vercel (frontend)

1. [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo.
2. **Root Directory:** `frontend`
3. **Framework:** Next.js (auto-detected)
4. **Environment variables** (Production):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_API_URL` | `https://resparts-api.onrender.com` (your Render URL, no trailing slash) |

5. Deploy.

6. Copy the Vercel URL → update Supabase **Site URL / Redirect URLs** and Render **`CORS_ORIGINS`**.

7. Redeploy Render if you changed `CORS_ORIGINS` (or trigger manual deploy).

---

## 4. Verify

1. Open `https://your-app.vercel.app/login` — sign in with your Supabase user.
2. Summary page loads prices (empty until upload/scrape).
3. Admin user sees **Upload Excel** + **Extract Data** in nav.
4. Browser devtools → Network: `/api/auth/me` returns **200** (not CORS 400).

Backend health: `https://resparts-api.onrender.com/health` → `{"status":"ok"}`

---

## 5. Local dev with Supabase Cloud (optional)

You can point local env at the cloud project instead of `supabase start`:

**`.env`** (backend):

```env
DATABASE_URL=postgresql://...supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_EMAILS=your@email.com
```

**`frontend/.env.local`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Add `http://localhost:3000` to Supabase redirect URLs.

---

## 6. CLI alternative (Supabase migrations)

If you use the Supabase CLI linked to your cloud project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This applies files in `supabase/migrations/`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `OPTIONS /api/auth/me` 400 | Add exact Vercel URL to Render `CORS_ORIGINS` |
| `Invalid token` | Check `SUPABASE_URL` on Render matches your project |
| DB connection failed | Use Session pooler URI + `?sslmode=require` |
| Blank page on Vercel | Check env vars are set for **Production**, redeploy |
| Render cold start | Wait ~30–60s after idle, or use paid plan |
| KSP scrape **403** on Render | KSP blocks datacenter IPs. Add `KSP_SCRAPER_API_KEY` on Render ([ScraperAPI](https://www.scraperapi.com) free tier) and redeploy |

### KSP scrape on Render (403 workaround)

KSP blocks requests from cloud hosts (Render, AWS, etc.). Pelephone does not.

1. Sign up at [scraperapi.com](https://www.scraperapi.com) (free tier: 5,000 requests/month).
2. Copy your API key.
3. **Render → resparts-api → Environment** → add:
   ```
   KSP_SCRAPER_API_KEY=your-key-here
   ```
4. Save and redeploy, then run **Extract Data → KSP** again.

Alternative: set `KSP_HTTPS_PROXY` to any residential HTTP proxy URL.

---

## Cost snapshot (typical)

- **Supabase** — free tier (Auth + 500MB DB)
- **Vercel** — free hobby tier
- **Render** — free or ~$7/mo Starter (always-on)

Do not commit `.env`, JWT secrets, or database passwords.

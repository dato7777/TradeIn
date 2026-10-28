# Phase 0 — Discovery (read-only)

Status: **accepted**. Live SQL (2026-10-28) is in the "Live results" note below. No production schema was changed in Phase 0.

Sources inspected: `supabase/migrations/001_init.sql` (the only migration), `supabase/config.toml`, the FastAPI backend (`backend/app/**`), the admin Next.js frontend (`frontend/**`), `render.yaml`, and the deployment docs.

**Limitation:** I had no connection to the live Supabase project (no MCP, no linked CLI, no schema dump). Everything below about production is inferred from the code and the one migration. Section 7 contains a read-only SQL script that confirms or corrects each assumption. Results from that script are needed before Phase 2.

---

## 0. Critical findings (fix before any public sign-up exists)

These affect the **existing admin system today**, independent of the new site. I have not changed anything; each needs your approval because the rules forbid touching the admin app without it.

| # | Finding | Severity | Why |
|---|---|---|---|
| C1 | **No RLS on any table** in `001_init.sql`. Production (2026-10-28): RLS is **already enabled** (not forced) on all five tables, with **no policies**. `anon`/`authenticated` still hold every table privilege (incl. TRUNCATE). | **Medium (confirmed)** | REST API requests with the public key get no rows (RLS deny-by-default). The leftover grants are still against the spec and are revoked by migration 002. |
| C2 | `backend/app/config.py` has a **default HS256 JWT secret** (`super-secret-jwt-token-with-at-least-32-characters-long`, the public Supabase local-dev value), and `decode_token` accepts HS256. | **Low (JWT secret is set on Render)** | The live backend does not use the default. Residual risk: HS256 is still accepted if someone obtains the real secret. Remove the fallback in the admin backend before Phase 5. |
| C3 | **Admin = email allowlist on the JWT `email` claim** (`ADMIN_EMAILS`). There is no check of `email_verified`, `app_metadata`, or `aud` beyond `authenticated`. Email sign-up **and** confirmation are both on. | **High once public sign-ups exist** | Public users land in the same `auth.users` pool. Sign-ups stay off until Phase 5 (D2); the admin check must be hardened before they are re-enabled. |
| C4 | `profiles` table (with a `role` column) exists but is **unused** by the backend. | Low | Confusing source of truth for "who is admin"; the name also collides with the `profiles` table the spec wants for public users. |

Good news: after the `/datadmin` change, every FastAPI data route requires an admin, and a non-allowlisted account gets **403**. The admin frontend never queries tables through Supabase (it uses Supabase only for login), so locking the tables down (C1) would **not** break the admin UI.

---

## 1. Map of existing database objects

All objects are in schema `public` (exposed by the Supabase API by default).

| Object | Kind | Used by | Purpose |
|---|---|---|---|
| `companies` | table | admin API, scrapers, Excel import | Company list: `slug`, `name`, `source_type` (`upload`/`scraper`), `grade_columns` JSONB, `trade_in_url`, `api_url`, `color` |
| `company_prices` | table | admin API (read), scrapers + Excel import (write) | One row per (company, `normalized_name`, `grade`): `brand`, `model`, `storage_gb`, integer `price`, `scraped_at` / `uploaded_at`, `job_id` |
| `scrape_jobs` | table | scrape orchestrator, Extract Data page | Status and progress of scrape runs |
| `upload_history` | table | Excel import | Who uploaded which file, row counts |
| `profiles` | table | **nothing** | Leftover `user_id`, `email`, `role` |
| `pgcrypto` | extension | `gen_random_uuid()` | — |

- **Views / functions / triggers:** none in production (2026-10-28).
- **RLS (production):** enabled, not forced, on all five tables. **Policies:** none.
- **Grants (production):** `anon` and `authenticated` still hold every privilege (SELECT through TRUNCATE). `service_role` too. Revoked by migration 002.
- **Indexes:** `company_prices(company_id)`, `(normalized_name)`, `(brand)`, plus the unique `(company_id, normalized_name, grade)`.

## 2. How the admin and scrapers connect

- **One path for everything server-side:** FastAPI (and the scrapers inside it) uses `psycopg.connect(DATABASE_URL)`. Per `docs/DEPLOYMENT.md`, that is the Supavisor **session pooler URI with user `postgres.<ref>`**, i.e. the **`postgres` role**.
- **Table owner:** tables were created by running `001_init.sql` in the SQL editor, which runs as `postgres` — so `postgres` most likely **owns all five tables**.
- **BYPASSRLS:** on Supabase, the `postgres` role normally has `BYPASSRLS`. If confirmed, enabling (non-forced) RLS on these tables keeps the admin and scrapers working unchanged. **Must be verified** (query 5) and tested on a branch or staging copy first.
- **Write pattern that matters later:** a scrape or upload does `DELETE FROM company_prices WHERE company_id = …` and re-inserts every row in one transaction. Row `id`s are therefore **not stable** across scrapes.
- The admin frontend talks to Supabase only for `signInWithPassword` / `getSession` / `signOut` (legacy **anon** key). No PostgREST table access.
- `SUPABASE_SERVICE_ROLE_KEY` exists in config but is **not used** anywhere.

## 2b. How admin users log in

- **Supabase Auth** (email + password) in the admin frontend → access token sent as `Bearer` to FastAPI.
- FastAPI verifies the JWT via the project **JWKS** (ES256/RS256), with an **HS256 fallback** using `SUPABASE_JWT_SECRET` (see C2).
- **Admin decision:** `role = "admin"` if the token's `email` (lower-cased) is in `ADMIN_EMAILS`; otherwise `viewer`. All data, export, import and scrape endpoints now require `admin`; `/api/auth/me` and `/health` are the only non-admin routes.
- **Weakness for the shared `auth.users` pool:** see C3. Isolation is **not proven** today. Options are in question 3 below.

## 3. How the spec's entities exist today

| Spec entity | Today | Gap |
|---|---|---|
| Companies | `companies` row per company | No logo, `is_active`, payout method/time, delivery method, public website, allowed hosts |
| Brands | `company_prices.brand` = `apple` / `samsung` (CHECK constraint) | No table; fine to derive |
| Device models | No table. `model` (e.g. `15 Pro Max`, `Galaxy S24 Ultra`) + `normalized_name` (`iPhone 15 Pro Max 256GB`) on each price row | No slug, display name per locale, release year, image |
| Storage options | `storage_gb` **text** (`64GB`, `1TB`) | Needs numeric sort / URL form (`?storage=256`) |
| Condition grades A–D | Per company, in `companies.grade_columns` JSON: `{key, label, summary_tier}`. **The normalized A–D grade is `summary_tier` 1–4, not the company's grade key.** Example: Pelephone `b` (תקין חלקית) is tier 3 = C; Pelephone has no B; Partner has only A | No he/en plain-language descriptions |
| Per-company condition policy | Only a short Hebrew label per grade | No policy details or policy URL |
| Prices per (company, model, storage, condition) | `company_prices`, integer ILS, `CHECK (price >= 0)` (zero allowed) | VAT basis differs per company (see risks) |
| Offer source URLs | Only `companies.trade_in_url` (one generic page). In the DB seed, **Dynamica and Partner have no URL**; the Dynamica URL was added only to the YAML config, which the public site cannot read | No per-offer destination URL, no host allowlist |
| Scrape runs / timestamps | `scrape_jobs` + `scraped_at` / `uploaded_at` per row | Freshness is per company in practice (full replace) |

## 4. Gaps and proposed migrations (names only)

All additive, versioned, with rollback notes; applied to a branch/staging project first. **No existing column types change, no data is modified, no FORCE RLS.**

1. `002_lock_down_admin_tables` — enable (non-forced) RLS on the five existing tables; revoke all from `anon`, `authenticated`, `PUBLIC`; no policies. Fixes C1. Applied only after confirming the admin role bypasses RLS.
2. `003_catalog_schema` — private schema (e.g. `catalog`) for new side tables, not exposed by the API.
3. `004_catalog_models` — curated models (brand, slug, he/en display name, release year, nullable `image_url`) mapped from `company_prices.model`; storage normalization helper.
4. `005_condition_grades` — A–D with he/en plain-language descriptions (`TODO(content)` where missing).
5. `006_company_public_profiles` — logo, `is_active`, payout method/time, delivery methods, public URL, **price VAT basis** per company.
6. `007_company_condition_policies` — per company per normalized grade: policy summary he/en + policy URL; replaces reading the JSON label.
7. `008_partner_tracking` — `allowed_hosts[]`, `tracking_mode`, `click_id_param`, static params, `utm_source_override`, `is_active`, default destination URL.
8. `009_offer_publication_overrides` — admin-only hide switch per offer.
9. `010_public_read_model` — `SECURITY DEFINER` RPCs with `search_path = ''`: brands, models, storage options, condition grades, `offers_for`, `model_price_summary`, companies, company policies, search. Stable `offer_ref` derived from (company slug, model slug, storage, grade). Freshness + zero-price + inactive + missing-URL filtering inside.
10. `011_outbound_clicks` — private click log + 13-month retention job.
11. `012_public_accounts` — public user profiles (new name, to avoid the existing `profiles`), `saved_phones`, own-history RPC, sign-up trigger. Depends on the answer to question 3.
12. `013_conversions` *(optional, feature-flagged)* — postback storage.

## 5. Risks

- **VAT basis is inconsistent.** Dynamica's catalog is VAT-excluded (the admin shows ×1.18 rounded to 10 behind a checkbox); KSP and Pelephone appear VAT-included. A public comparison without normalization would rank Dynamica unfairly low.
- **Stale prices.** Upload-only companies (Partner; Dynamica when uploaded) can be weeks old, so they would be hidden after `PRICE_HIDE_HOURS` (168h) unless refreshed.
- **Zero prices** are allowed by the schema (e.g. Mahsaney's list contains ₪0 rows) and must be excluded in the read model.
- **Duplicate or variant model names** (`iPhone 17 Air` vs `iPhone Air`, `16e`, Fold/Flip naming) despite the normalizer.
- **Unstable row ids** due to delete-and-reinsert, so `offer_ref` must be derived, not an id.
- **Missing offer URLs** for Dynamica and Partner in the DB; only generic company pages for the others. Partners may not attribute deep links without an agreement.
- **Missing images and logos**; usage rights unconfirmed.
- **Grade coverage gaps:** Pelephone has no B; Partner has only A, so some (model, condition) combinations will have one offer or none.
- **Domain conflict:** the admin Vercel project currently owns `resparts.vercel.app`. A separate public Vercel project needs that domain, so the admin must move to another domain.
- **Legacy keys:** the admin uses the legacy anon key. The new site should use the publishable/secret keys, which must exist on this project.
- **No staging/branch yet** to test migrations (Supabase branching needs a paid plan).

## 6. Blocking questions

1. **Live state:** please run the read-only script in section 7 in the Supabase SQL editor and paste the output, and confirm (yes/no only, never the value) that `SUPABASE_JWT_SECRET` is set on Render. Also: in Supabase → Authentication → Providers → Email, are "Allow new users to sign up" and "Confirm email" on?
2. **Apps and domains:** OK to build the public site as a separate Next.js app in `web/` in this repo, deployed as its own Vercel project that takes `resparts.vercel.app`, while the admin moves to a new Vercel domain (still under `/datadmin`)?
3. **Auth isolation:** separate Supabase project for public user accounts (strongest isolation), or the same project with a hardened admin check (verified email + `app_metadata` role + allowlist) and sign-ups disabled until Phase 5?
4. **Companies and VAT:** which companies go public (KSP, Dynamica, Pelephone — and Partner?), and should every public price be VAT-inclusive (Dynamica ×1.18, rounded to 10)?
5. **Staging and lockdown:** do you have (or can you create) a staging Supabase project or branch for testing migrations, and do you approve fixing C1 (and C2/C3 in the admin backend) as the very first change?

**Live results (2026-10-28, section 7 script):**
- RLS is **already enabled** (not forced) on all five tables, owner `postgres`, and there are **no policies**. API requests with the anon/publishable key therefore get no rows and cannot write. **C1 is downgraded to Medium:** `anon` and `authenticated` still hold full table grants (including TRUNCATE). These are not reachable through the REST API, but the spec requires revoking them.
- `postgres` has `BYPASSRLS` (the admin and scrapers already work with RLS on). `service_role` also bypasses RLS.
- No functions in `public` and no tables in the Realtime publication.
- One auth user, 0 unconfirmed.
- Freshness: KSP, Pelephone and Dynamica were last updated 2026-10-21, close to the 168h hide window. Partner was last updated 2026-06-01 and has 6 zero prices. Pelephone has **234 zero prices**. Dynamica and Partner have no `trade_in_url`.

**Answers (2026-10-28):** D1–D7 in `docs/DECISIONS.md`. Question 1 closed: SQL output received; `SUPABASE_JWT_SECRET` is set on Render; email sign-up and confirm-email are both on.

Content I will draft as `TODO(content)` unless you provide it: payout methods/times, delivery methods, condition policy texts and URLs, logos, A–D descriptions, and the public brand name.

---

## 7. Read-only inspection script (run in Supabase SQL editor)

Only `SELECT`s. It prints no emails, passwords or keys.

```sql
-- 1. Tables: owner, RLS on/forced
select n.nspname as schema, c.relname as object, c.relkind,
       pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m')
order by 2;

-- 2. Privileges granted to API roles
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','PUBLIC','service_role')
group by table_name, grantee
order by 1, 2;

-- 3. Existing policies
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public';

-- 4. Functions in public
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- 5. Role attributes
select rolname, rolsuper, rolbypassrls, rolcanlogin
from pg_roles
where rolname in ('postgres','anon','authenticated','service_role','authenticator')
order by 1;

-- 6. Realtime publication
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime';

-- 7. Company configuration (no secrets)
select slug, name, source_type, trade_in_url is not null as has_url, grade_columns
from public.companies order by slug;

-- 8. Price freshness and quality per company
select co.slug, count(*) as rows,
       min(coalesce(cp.scraped_at, cp.uploaded_at)) as oldest,
       max(coalesce(cp.scraped_at, cp.uploaded_at)) as newest,
       count(*) filter (where cp.price <= 0) as zero_prices,
       count(distinct cp.model) as models
from public.company_prices cp
join public.companies co on co.id = cp.company_id
group by co.slug order by 1;

-- 9. Auth users (counts only)
select count(*) as total,
       count(*) filter (where email_confirmed_at is null) as unconfirmed
from auth.users;
```

Also check in the dashboard (no values needed): **Settings → API Keys** — do `sb_publishable_…` and `sb_secret_…` keys exist? **Settings → API → Exposed schemas** — which schemas are listed?

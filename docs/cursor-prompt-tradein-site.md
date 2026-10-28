# Cursor Master Prompt: Public Trade-In Price Comparison Website (Israel)

> Paste this whole file into Cursor (Plan/Agent mode). Save Appendix A as `.cursor/rules/project.mdc` so the non-negotiables persist across sessions.

---

## 0. How to work (read first)

You are a senior full-stack engineer and security-minded architect. You are building the **public, user-facing website** of a used-phone trade-in price comparison service for Israel.

**Working rules**
1. Work strictly in the phases in section 15. At the start of each phase: state the plan and the files you will touch. After each phase: run lint, typecheck, tests and build, summarize in under 15 lines, then **stop and wait for my approval** before the next phase.
2. Ask questions only when truly blocked (max 5, all at once, at the end of Phase 0). Otherwise choose the safest default and record it in `docs/DECISIONS.md` (decision, alternatives, reason).
3. **Never** run destructive database operations (DROP, TRUNCATE, DELETE without WHERE, disabling RLS, changing existing column types) and never modify existing data. All schema changes are **additive, versioned SQL migrations** with rollback notes, applied first to a Supabase branch or staging project, never directly to production.
4. **Do not modify the existing admin application or the scrapers.** Existing admin: Next.js + TypeScript + React + Tailwind frontend, Python **FastAPI** backend, **PostgreSQL** (hosted on Supabase). The public site is a **separate app** (own repo or clearly separated package, own Vercel project, own environment variables and secrets). It shares **only the database**, and only through the controlled read layer in section 4: no shared code, no shared secrets, no shared sessions with the admin.
5. No placeholder security. If something cannot be done in code (a Supabase dashboard setting), add it to `docs/SUPABASE_SETUP_CHECKLIST.md` with exact steps for me to apply manually.
6. Do not copy the layout, wording, imagery, logos or names of any competitor site. Build an original brand and original UI.

---

## 1. Product context

- Users pick a phone (mainly **Apple and Samsung**), its **storage**, and its **condition**, then see a ranked comparison of buyback/trade-in prices from several Israeli companies. They click through to the company whose price they like.
- Companies currently scraped into Supabase: **KSP, Dynamica, Pelephone**. More will be added later, so nothing may be hard-coded per company; everything is data-driven.
- My internal normalized condition scale is **A, B, C, D**. **D = faulty phone, lowest price.** Each company has its own condition policy with details, stored in my admin database. The public site must show the normalized grade **and** each company's own policy details for that grade.
- The site is for Israeli users: **ILS currency, Hebrew (RTL) primary plus English (LTR)**.
- The business earns from referrals, so **outbound click attribution is critical** (section 8).

## 2. Assumed stack (confirm in Phase 0; deviate only with a written reason)

- **Next.js** (latest stable, App Router) + **TypeScript (strict)** + **Tailwind CSS** + **shadcn/ui (Radix)** (same core stack as my admin frontend, so tooling stays familiar; the admin's FastAPI backend is **not** used by the public site)
- **Supabase**: Postgres + Auth, via `@supabase/supabase-js` and `@supabase/ssr`
- **Zod** (all validation), **React Hook Form**, **next-intl** (he/en), **next/font** (self-hosted font)
- Hosting: **Vercel**. Rate limiting: **Upstash Redis** (`@upstash/ratelimit`) or Vercel WAF rules.
- Tests: **Vitest**, **Playwright**, **axe-core**, **pgTAP** (`supabase test db`), **Lighthouse CI**
- Use the current Supabase key names: **publishable key** (`sb_publishable_...`) in the browser and **secret key** (`sb_secret_...`) on the server only. Legacy `anon` / `service_role` keys are being retired, so do not build on them.

---

## 3. Phase 0 discovery (read-only)

Before writing code, inspect my real Supabase project (use the Supabase MCP / CLI / schema dump I provide) and produce `docs/DISCOVERY.md` containing:
1. A map of existing tables, views, functions, RLS status, grants and policies, and which are used by the admin and scrapers.
2. **How the admin and scrapers connect** to Postgres. My admin backend is FastAPI, so it most likely uses a **direct Postgres connection string** (often the `postgres` role) or the Supabase secret/service key. Determine exactly which role it uses, whether that role has `BYPASSRLS`, and which role **owns** the tables. Roles that bypass RLS keep working when RLS is enabled, but a role that does not bypass it would break. **Never use `FORCE ROW LEVEL SECURITY` on existing admin-owned tables** (it would also lock out the owner role). Do not enable RLS on any existing table until this is known and verified on a branch/staging copy.
2b. **How admin users log in.** Does the admin use **Supabase Auth** or its own FastAPI auth? If it uses Supabase Auth or trusts Supabase JWTs, this is critical: public sign-ups land in the **same `auth.users` pool**. Admin authorization must then rely on an explicit admin allowlist or `app_metadata` role, never on "any authenticated user". Report exactly how the admin decides who is an admin, and flag any weakness **before** any public sign-up exists. If isolation cannot be proven, propose a separate Supabase project for public auth and mark it as a blocking question.
3. How these entities are represented today: companies, device models (normalized names), storage options, condition grades A–D, per-company condition policies, prices per (company, model, storage, condition), source URLs per offer, scrape runs and timestamps.
4. Gaps versus the requirements in this prompt, and the exact list of proposed migrations (names only, no SQL yet).
5. Risks (data quality, stale prices, duplicate models, missing images, missing offer URLs).
6. Up to 5 blocking questions.

Then **stop**.

---

## 4. Data architecture: a public read model, not raw tables

Principles
- The public site must **never read raw/admin/scraper tables directly**. Base tables stay private: RLS enabled, **no policies for `anon`/`authenticated`**, and `REVOKE ALL` from `anon`, `authenticated` and `PUBLIC`.
- Expose a small, versioned **public read model** (read-only) containing only whitelisted columns. Implement it as either (a) `SECURITY DEFINER` functions (RPC) with `set search_path = ''`, fully qualified names, strict typed args, and `EXECUTE` granted only to the needed roles, or (b) views that are safe by design (if you use views, be explicit about `security_invoker` behavior and the Supabase security advisor warnings). **Choose one approach and justify it in `docs/SECURITY.md`.** The Supabase Security Advisor must show **zero** errors and warnings for objects you add.
- **Writes** to anything (including click logs) never happen through `anon` access. See section 8.

Public read model must provide (names are suggestions, adapt to my schema)
- `brands` (Apple, Samsung) and `models` (slug, display name, brand, release year, nullable `image_url`)
- `model_storage_options` and `condition_grades` (A–D with generic plain-language descriptions, localized he/en, **read from my DB where it exists; where missing, propose text for my approval and mark as `TODO(content)`**)
- `offers_for(model_slug, storage, condition)` returns, per company: price (integer ILS), company name/slug/logo, payout method, payout time, delivery method (mail/drop-off/in-store), `last_updated_at`, **company-specific condition policy summary + policy URL**, and a **stable `offer_ref`**
- `model_price_summary` (top price, number of offers, min/max) for cards on list pages
- `companies` and `company_condition_policies` for the company pages

Data-quality rules enforced **in the read model**, not in the UI
- Exclude null, zero or negative prices, inactive companies, and offers without a valid destination URL.
- **Freshness**: normal if updated within `PRICE_FRESH_HOURS` (default 48); shown with a "may be outdated" flag until `PRICE_HIDE_HOURS` (default 168); hidden afterwards. Both configurable.
- Let me hide a specific offer without touching scraped tables: add an additive side table such as `offer_publication_overrides` (admin-writable only).
- Prices are stored and transported as **integers (ILS)**, never floats. Format with `Intl.NumberFormat('he-IL' | 'en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })` and `tabular-nums`.
- `offer_ref` is a **stable, opaque identifier** derived from (company, model, storage, condition), so links keep working when a scrape replaces rows. Unknown or expired refs must degrade gracefully (friendly page that sends the user back to the results), never a 500.

Performance
- Indexes for the access paths above (verify with `EXPLAIN`), pagination limits on every list, no `select *`, generated TypeScript types from the schema (`supabase gen types`), a single server-side data-access layer (`src/server/data/*`) and **no Supabase queries inside UI components**.
- Public catalog pages are **cacheable** (ISR or static with `revalidate` + cache tags). Add a secured revalidation endpoint (section 12) so my admin can refresh pages after a scrape.

---

## 5. Security requirements (non-negotiable)

**Database / Supabase**
- RLS enabled on **every** table in exposed schemas; deny by default; explicit policies per role (`TO anon` / `TO authenticated`); never `USING (true)` on anything writable; use `(select auth.uid())` in policies for performance; index columns used in policies.
- Authorization data only from `app_metadata` or server-side tables, **never `user_metadata`** (users can edit it).
- **A freshly signed-up public user must have zero access to anything admin-related**: no admin table access via the API, and no way to pass the admin backend's authorization checks. Prove it with a pgTAP test, and with a documented manual check against the FastAPI admin endpoints (a new public account must get 401/403 everywhere).
- Do not use `FORCE ROW LEVEL SECURITY` on existing admin-owned tables; keep admin and scraper access working exactly as it does today (verify on a branch/staging copy before production).
- Every `SECURITY DEFINER` function: `set search_path = ''`, schema-qualified references, input validation, `REVOKE EXECUTE ... FROM PUBLIC` and explicit grants.
- Restrict which schemas the API exposes; keep internal objects out of the exposed schema. Disable Realtime on tables that do not need it.
- The **secret key** is used in **one server-only module** (click logging, section 8) and nowhere else. Mark it with `import 'server-only'`, never prefix it `NEXT_PUBLIC_`, add an ESLint import-boundary rule that fails the build if client code imports it, and never log it.
- Provide `supabase/tests/*.sql` (pgTAP) proving: `anon` and `authenticated` cannot select/insert/update/delete any base, admin or click-log table; `anon` can only use the public read model; user A cannot read or modify user B's profile, saved phones or history; privilege escalation via `user_metadata` is impossible.

**Application**
- Validate **all** input with Zod (route params, query strings, bodies, env). Never trust client-supplied prices, URLs, company IDs or redirect targets.
- Escape `%` and `_` in search input before using it in `ILIKE`; limit length (≤ 64) and results (≤ 8); minimum 2 characters.
- No `dangerouslySetInnerHTML`. Condition policy text coming from the admin DB is rendered as plain text (or sanitized Markdown with a strict allowlist).
- **Open redirect protection**: any `next`/`returnTo` parameter accepts only same-origin relative paths that start with a single `/` (reject `//`, backslashes, schemes). Outbound redirects use only DB-stored, allowlisted destinations (section 8).
- **Security headers** (via proxy/middleware and `next.config`): strict **CSP with per-request nonces** (no `unsafe-inline` for scripts; allow only what is needed for Supabase, the CAPTCHA provider and analytics), `Strict-Transport-Security` (preload-ready), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera/mic/geolocation etc.), `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy: same-origin`.
- CSRF: use Server Actions (same-origin enforced) or verify `Origin`/`Host` on state-changing route handlers; cookies `HttpOnly; Secure; SameSite=Lax`.
- **Rate limiting** (per IP and, when logged in, per user): `/go/*`, `/api/search`, all auth actions, revalidation and any form. Return `429` with `Retry-After`. Fail closed for auth routes.
- **Bot protection**: Cloudflare Turnstile (or hCaptcha) on sign-up, sign-in, password reset.
- Errors: generic messages to users, structured server logs without PII or secrets. Never leak stack traces. Add Sentry with PII scrubbing.
- Auth-aware responses are never cached or shared: pages with user-specific content are dynamic with `Cache-Control: private, no-store`.
- Supply chain: pinned lockfile, `npm audit --omit=dev` in CI, Dependabot/Renovate, `gitleaks` pre-commit and in CI, no secrets in the repo, `.env.example` only, env validated at boot (fail fast).
- Write `docs/SECURITY.md`: threat model (STRIDE-style table), what each Supabase role can do, how secrets are handled, and the incident checklist (key rotation steps).

---

## 6. Authentication and accounts (Supabase Auth)

Required methods
1. **Continue with Google** (OAuth, PKCE flow).
2. **Email + password for any email provider**, with **mandatory email confirmation**: the account is usable only after the user clicks the link in the email we send. Handle the confirmation callback securely (`/auth/confirm` verifying `token_hash` + `type`, then redirecting to a validated `next`).
3. Password reset by email.
4. *(Optional, behind a flag)* passwordless email one-time code.

Implementation rules
- Use `@supabase/ssr` with cookie sessions and a **proxy/middleware that refreshes the session**. On the server, protect pages and data with **`supabase.auth.getClaims()`** (signature-verified) or `getUser()`. **Never trust `getSession()` on the server.**
- Keep catalog pages cacheable: render the auth-aware header as a client island or a Suspense-isolated dynamic component so user-specific HTML is never cached.
- Hardening: generic error messages (no account enumeration), minimum password length 12, leaked-password protection if the plan supports it, CAPTCHA on all auth forms, rate limits, exact allowlisted redirect URLs (no wildcards in production), unused providers disabled, refresh-token rotation on.
- Tables (all RLS, owner-only): `profiles` (created by a `SECURITY DEFINER` trigger on `auth.users`), `saved_phones` (unique per user+model+storage, capped per user), and a read-only view of the user's own `outbound_clicks` history **through a safe RPC** (the table itself stays private).
- Account page: profile, saved phones, click history, **delete account** (cascades personal data) and **export my data**.
- Email deliverability matters for confirmation emails: add `docs/SUPABASE_SETUP_CHECKLIST.md` steps for **custom SMTP** with SPF, DKIM and DMARC, localized (he/en) email templates, Auth rate limits, CAPTCHA enablement, the site URL and the redirect allowlist.

---

## 7. Pages, routes and menus

Routes (Hebrew default at `/`, English under `/en`):

| Route | Purpose |
|---|---|
| `/` | Home: hero with model search, brand tiles, popular models, how it works, trust strip, FAQ teaser |
| `/sell/[brand]` | Models of Apple or Samsung with "Up to ₪X" and "Compare N offers" |
| `/sell/[brand]/[model]` | **Core page**: storage + condition selectors, ranked offers, per-company policy details |
| `/go/[offerRef]` | Outbound redirect with attribution (section 8) |
| `/companies`, `/companies/[slug]` | Company profile + its condition policy per grade |
| `/condition-guide` | A–D explained, with each company's mapping |
| `/how-it-works`, `/faq`, `/about`, `/methodology` | Trust and SEO content |
| `/privacy`, `/terms`, `/affiliate-disclosure` | Legal drafts (`TODO(legal)`, I will have them reviewed) |
| `/login`, `/signup`, `/auth/callback`, `/auth/confirm`, `/reset-password` | Auth |
| `/account`, `/account/saved`, `/account/history` | Protected |
| `/api/search`, `/api/revalidate` | Typeahead and secured cache refresh |
| `sitemap.xml`, `robots.txt`, custom 404/500 | `/go/*`, `/account/*`, `/api/*` disallowed |

Menus
- **Header** (sticky, white): logo, *Sell Apple*, *Sell Samsung*, *How it works*, *Condition guide*, *Companies*, language switch (he/en), *Log in / Sign up* (or user menu). Mobile: hamburger opening an accessible drawer, with the search icon always visible.
- **Footer**: about, methodology, FAQ, legal pages, affiliate disclosure, contact, language switch.

Core page behavior (`/sell/[brand]/[model]`)
- State lives in the URL (`?storage=256&condition=B`) so results are shareable and server-rendered; canonical URL is the clean model URL.
- Defaults: the most common storage and condition B.
- Offers are **sorted by price, highest first**. Ties are broken by freshness. The ranking is **never influenced by commission** (state this on `/methodology`).
- Each offer shows: company logo (self-hosted, `next/image` with an allowlist), large price, **Best price** badge, payout method and time, delivery method, "updated X ago", an expandable **"Condition policy of this company for grade X"**, and the CTA **"Go to offer"** (primary action).
- Show a short disclosure next to the CTA ("We may earn a commission; it does not affect ranking") and the disclaimer "Prices are indicative; the final price is set by the company after inspection."
- Empty states: "No offers for this combination" with suggestions (nearby condition or storage). Loading: skeletons. Errors: friendly retry.

---

## 8. Outbound redirect and attribution (critical)

Goal: when a user clicks an offer, the destination company must be able to **identify that the visitor came from my site**, and I must be able to reconcile clicks with partner reports.

**Link markup**: `<a href="/go/{offerRef}" target="_blank" rel="sponsored nofollow noopener">`. **Do not add `noreferrer`**, it would strip the referrer that partners use for attribution.

**`GET /go/[offerRef]` (Route Handler, server only)**
1. Validate `offerRef` with Zod. Rate limit. Ignore `HEAD` and obvious prefetch requests (do not log them as clicks). Send `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
2. Resolve the offer **server-side from the database** (destination URL, company, tracking config). **Never accept a destination URL from the client.**
3. Validate the destination: `https:` only, host must match the company's `allowed_hosts` allowlist. Otherwise return 404 and log an alert.
4. Build the final URL with a safe URL builder (`new URL`, `searchParams.set`, preserve existing query):
   - `utm_source=<TRACKING_UTM_SOURCE>` (my site's identifier, from env)
   - `utm_medium=comparison`
   - `utm_campaign=tradein` (optionally `tradein-<brand>`)
   - `utm_content=<model-slug>_<storage>_<condition>`
   - **Unique click ID** in the partner's own parameter name (configurable per company, e.g. `subid`, `clickref`, `aff_sub`, or `click_id`): a time-sortable unique ID (UUIDv7/ULID) generated per click.
   - **No personal data in any outbound URL** (no email, user ID, or IP). The click ID is opaque.
5. Log the click through **one server-only module** using the secret key: `click_id`, `offer_ref`, company, model, storage, condition, **price shown at click time**, locale, nullable `user_id`, hashed IP+UA (HMAC with a secret and daily-rotating salt; never store raw IP), referrer path, timestamp, and the final URL parameters used. Table `outbound_clicks` is private (RLS on, no client policies). Retention policy: purge after 13 months (scheduled job).
6. Respond with **302** to the final URL. If logging fails, still redirect (never block the user), but report the failure to monitoring.

**Per-company tracking configuration** (new additive table, e.g. `partner_tracking`): `allowed_hosts[]`, `tracking_mode` (`utm_only` | `affiliate_params` | `s2s`), `click_id_param`, extra static params (e.g. an affiliate/partner ID), `utm_source_override`, `is_active`. Adding a company must need **zero code changes**.

**Optional (build behind a feature flag in the last phase)**: server-to-server conversion postbacks at `/api/postbacks/[company]` with shared-secret/HMAC verification (constant-time compare), replay protection, idempotency by click ID, strict Zod schema, rate limiting, and a private `conversions` table linked to `outbound_clicks`.

**Documentation**: write `docs/TRACKING.md` with the exact URL format, parameter meanings, a sample URL, and a ready-to-send paragraph I can give each company so they can recognize and credit my traffic. Note in it that UTM parameters only identify traffic. Being credited for sales requires an agreement and a partner/affiliate ID or postback with each company.

---

## 9. Design system (bright, white, trustworthy)

Direction: clean white background, generous whitespace, strong price typography, one trustworthy primary color, one "money/positive" accent. Use **generic comparison-site patterns**: hero with big search; brand tiles; popular-model cards with "Up to ₪X" and "Compare N offers"; a 3-step selector (Model → Storage → Condition); an offers list (cards on mobile, table-like rows on desktop) with a prominent CTA; how-it-works steps; FAQ accordion. Create original visuals and copy.

Tokens (CSS variables + Tailwind theme; **verify every text/background pair meets WCAG AA**)
- Background `#FFFFFF`, surface `#F8FAFC`, border `#E2E8F0`
- Text `#0F172A`, muted text `#475569`
- Primary `#1D4ED8` (hover `#1E40AF`), CTA / positive `#047857` (hover `#065F46`)
- Best-price badge: background `#ECFDF5`, text `#065F46`
- Warning `#B45309`, error `#B91C1C`, focus ring `#1D4ED8` (2px, offset 2px)
- Radius 12px (cards), 10px (inputs/buttons); subtle shadows; 4px spacing scale; container max width 1200px
- Font: **Heebo** (Hebrew + Latin) via `next/font` (self-hosted at build time, no runtime calls to Google)

Components to build (documented in a `/design-system` dev-only page): Header, MobileDrawer, ModelSearchCombobox (accessible combobox pattern), BrandTile, ModelCard, StepIndicator, StorageSelector, **ConditionSelector** (A–D cards with plain-language description and an info dialog), OfferCard/OfferRow, PriceTag, BestPriceBadge, FreshnessLabel, PolicyAccordion, FilterBar (bottom sheet on mobile), HowItWorks, FAQ, TrustStrip, EmptyState, Skeletons, Toast, Breadcrumbs, Footer, AuthForms.

Responsive and RTL
- **Mobile-first**; verify at 320, 375, 768, 1024, 1280 and 1536 px; no horizontal scroll; touch targets ≥ 44px; safe-area insets; use `dvh`.
- Use **CSS logical properties** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`) and `dir` set per locale so Hebrew RTL and English LTR both look correct. Icons that imply direction must flip.
- Phone images: no hotlinking from manufacturers or companies. Use a neutral device illustration per brand until I supply licensed images (`image_url` nullable). Company logos are served from my own storage and I will confirm usage rights.

---

## 10. SEO, performance, accessibility

- Per-page `metadata`, canonical URLs, `hreflang` he/en, OpenGraph, `sitemap.xml` generated from models and companies.
- JSON-LD only where truthful: `Organization`, `WebSite` (SearchAction), `BreadcrumbList`, `FAQPage`. **Do not mark buyback quotes up as product sale offers.**
- Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms, Lighthouse ≥ 95 (Performance, Accessibility, Best Practices, SEO) on mobile for home and model pages. Use `next/image`, font preloading, minimal client JS, streaming and Suspense.
- **WCAG 2.2 AA**: keyboard-only use, visible focus, labelled inputs, ARIA only where needed, dialog/combobox patterns done correctly, `prefers-reduced-motion`, skip link, correct heading order, and `lang`/`dir` set per locale.

---

## 11. Privacy and legal (build the plumbing; I will get the texts reviewed)

- Data minimization. Prefer **cookieless analytics** (Plausible/Umami/Vercel Web Analytics). Essential cookies only (auth session). If any non-essential tracking is added, show a consent banner and block it until consent.
- Pages `/privacy`, `/terms`, `/affiliate-disclosure` as clearly marked drafts (`TODO(legal)`); no invented legal claims.
- Honest-ranking and disclosure copy per section 7. Account deletion and data export per section 6.
- Click log retention and hashing per section 8.

---

## 12. Cache refresh endpoint (admin to public site)

`POST /api/revalidate`: requires a shared secret **and** an HMAC signature of the body with a timestamp (reject if older than 5 minutes), constant-time comparison, strict Zod body (`{ tags: string[] }` from an allowlist), rate limited. It lets my admin trigger revalidation after a scrape. Document the request format in `docs/ADMIN_INTEGRATION.md`, including a ready-to-paste **Python (FastAPI) snippet** that signs the body (HMAC-SHA256 with timestamp) and calls the endpoint with `httpx` after a scrape finishes. The admin backend must only ever call this endpoint; the public site never calls the admin backend.

---

## 13. Environment variables (validate with Zod at boot; provide `.env.example`, never real values)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `TRACKING_UTM_SOURCE`, `CLICK_HASH_SECRET`, `REVALIDATE_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `PRICE_FRESH_HOURS`, `PRICE_HIDE_HOURS`. The site name and domain are not decided yet: keep them in config, never hard-coded.

---

## 14. Testing and CI

- **Unit (Vitest)**: price formatting, freshness logic, URL builder (parameter preservation, encoding, host allowlist, rejection of non-https and foreign hosts), redirect-target validation, Zod schemas, rate-limit helper.
- **Database (pgTAP)**: section 5 policy tests, plus read-model tests (stale/hidden/zero-price offers excluded, `offer_ref` stability).
- **E2E (Playwright)**: search, pick storage and condition, see sorted offers, click "Go to offer", assert the redirect URL contains `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and the click ID, and that a click row was recorded. Auth flows: Google (mocked), email sign-up with confirmation (use Supabase local Inbucket), protected-route redirect, account deletion.
- **Visual and responsive**: screenshots at 320/375/768/1280 in both RTL and LTR; **axe** on every route; Lighthouse CI thresholds as gates.
- **CI (GitHub Actions)** on every PR: lint, typecheck, unit, pgTAP, build, Playwright, axe, Lighthouse CI, `npm audit --omit=dev`, `gitleaks`, and CodeQL or Semgrep. Main branch protected.

---

## 15. Phases and acceptance criteria

**Phase 0: Discovery.** Deliver `docs/DISCOVERY.md` and stop. *Accepted when* I confirm the proposed migrations and answers.

**Phase 1: Foundation.** Scaffold, tokens and Tailwind theme, layout and menus, i18n he/en with RTL, security headers and CSP, env validation, error pages, CI, `docs/DECISIONS.md`. *Accepted when* the shell renders correctly on all viewports in both directions, headers score A on a security-headers scan, and CI is green.

**Phase 2: Data layer and RLS.** Additive migrations (on a branch/staging), public read model, side tables, generated types, data-access layer, pgTAP tests. *Accepted when* Security Advisor shows zero issues for new objects, the admin still works unchanged, and all policy tests pass.

**Phase 3: Catalog UX.** Home, brand pages, model page with selectors and ranked offers, search, company and condition pages, empty/loading/error states, ISR with tags. *Accepted when* a user can go from search to a ranked offer list on mobile in under 5 taps and Lighthouse targets are met on the model page.

**Phase 4: Outbound redirect and attribution.** `/go`, partner tracking config, click logging, rate limiting, `docs/TRACKING.md`, optional postbacks behind a flag. *Accepted when* the E2E attribution test passes, open-redirect and host-allowlist tests pass, and no client bundle contains the secret key.

**Phase 5: Auth and accounts.** Google + email confirmation + reset, protected routes, profile, saved phones, history, delete/export, SMTP/dashboard checklist. *Accepted when* all auth E2E tests pass and RLS isolation between users is proven by tests.

**Phase 6: Hardening and polish.** Revalidation endpoint, SEO/sitemap, legal drafts, a11y fixes, performance tuning, dependency and secret scans, and a **final security review report** (`docs/SECURITY_REVIEW.md`: what was checked, findings, fixes, residual risks). *Accepted when* every checkbox below is ticked.

### Definition of done
- [ ] No raw/admin table is readable by `anon` or `authenticated`; pgTAP proves it
- [ ] A new public account gets zero access to admin tables and 401/403 from every admin endpoint; admin and scrapers verified working unchanged
- [ ] Secret key exists only in one server-only module; bundle scan confirms it is absent from client code
- [ ] Every outbound click is allowlisted, attributed (UTM + click ID), logged, and rate limited
- [ ] No PII in outbound URLs; no raw IPs stored
- [ ] Auth: Google + confirmed-email signup work; server checks use `getClaims()`/`getUser()`
- [ ] CSP with nonces, HSTS and the other headers active; no inline script violations
- [ ] RTL and LTR verified at all breakpoints; axe has zero serious/critical issues
- [ ] Lighthouse and Core Web Vitals targets met on mobile
- [ ] Docs complete: DISCOVERY, DECISIONS, SECURITY, SECURITY_REVIEW, TRACKING, ADMIN_INTEGRATION, SUPABASE_SETUP_CHECKLIST, README

At the end of every phase, report: what changed, tests run and results, security checks performed, open risks, and what you need from me.

---

## Appendix A: `.cursor/rules/project.mdc` (save this file)

```
---
description: Non-negotiable rules for the trade-in comparison public site
alwaysApply: true
---
- Never touch the admin app (Next.js + FastAPI + Postgres) or scrapers. The public site is a separate app sharing only the database via the read model. Only additive, versioned SQL migrations; test on a branch first.
- Never use FORCE ROW LEVEL SECURITY on existing admin-owned tables. Public sign-ups must have zero admin access (shared auth.users pool risk).
- Never disable RLS, never use USING (true) on writable tables, never use user_metadata for authorization.
- Public site reads only through the public read model (RPC/views). Never query raw/admin tables from public code.
- The Supabase secret key is server-only, used in exactly one module (click logging). Never NEXT_PUBLIC_, never logged.
- On the server use supabase.auth.getClaims() or getUser(); never trust getSession().
- Validate every input with Zod. Never accept a destination URL or price from the client.
- Outbound links: rel="sponsored nofollow noopener" (never noreferrer); redirect only to DB-stored, allowlisted https hosts; UTM + opaque click ID; no PII in URLs.
- No dangerouslySetInnerHTML. Strict CSP with nonces. Rate limit /go, auth, search, revalidate.
- Prices are integer ILS. Use logical CSS properties; support he (RTL) and en (LTR).
- Mobile-first, WCAG 2.2 AA. No secrets in the repo. Work phase by phase and stop for approval.
```

# Security — public site

Scope: the public site (`web/`) and the database objects it uses. The admin (`frontend/`, `backend/`) is covered only where it shares the database.

## Read model approach (spec §4)

**Choice: SECURITY DEFINER functions in a private schema, called through SECURITY INVOKER wrappers in the only exposed schema.** Views were rejected.

| Schema | Exposed by API | Contents | API roles can |
|---|---|---|---|
| `public` | yes (legacy) | admin/scraper tables | nothing (RLS on, no policies, all grants revoked — migration 002) |
| `catalog` | no | side tables + internal helper functions | nothing (no schema usage) |
| `read_model` | no | `SECURITY DEFINER` functions, owner `postgres`, `search_path = ''` | `anon` / `authenticated`: the 8 read functions only. `service_role`: `resolve_offer` and `record_click` only |
| `public_site` | yes | `SECURITY INVOKER` wrappers | same split. The two click wrappers are not granted to `anon` or `authenticated` |

Why:
- **Views** would either run with the owner's rights (`security_definer_view`, a Security Advisor error) or need `SELECT` grants and policies for `anon` on base tables, which the spec forbids.
- **Definer functions directly in an exposed schema** trigger the Security Advisor warnings for definer functions executable by `anon`/`authenticated`. Keeping them in a non-exposed schema avoids that, while the API can still reach them only through the wrappers.
- Functions return **whitelisted columns only** (row types in `read_model`), validate their arguments, cap result sizes, and enforce every data-quality rule (`catalog.visible_offers()`), so the UI cannot bypass them.

Proven by `supabase/tests/001_privileges.test.sql` and `002_read_model.test.sql` (run with `npm run test:db` in `web/`, and in CI).

## What each role can do

| Role | Used by | Capabilities |
|---|---|---|
| `postgres` | FastAPI admin + scrapers (direct connection), SQL editor | Owner of all tables; `BYPASSRLS`. Unchanged. |
| `anon` | Public site (publishable key, server-side, no session) | Execute the 8 `public_site` read functions. No table access. Cannot resolve a destination or write a click. |
| `authenticated` | Signed-in users (Phase 5) | Same as `anon` today. Own-data policies arrive in Phase 5. |
| `service_role` | Secret key, click logging only (Phase 4) | Calls `resolve_offer` and `record_click` from one server-only module. Bypasses RLS, but has no grant on `catalog.outbound_clicks`; the definer function writes the row. |

## Secrets

- The publishable key is the only Supabase key the site uses in Phase 2. It is read server-side through `src/env/server.ts` (`server-only`, Zod-validated at boot; legacy JWT-style keys are rejected).
- The secret key (Phase 4) will live in one `server-only` module. ESLint blocks `@/server/*`, `@/env/server` and `@supabase/*` imports from components, and `@supabase/*` from pages.
- No secrets in the repo: `.env*` is ignored except `.env.example`; gitleaks runs in CI.
- Never prefix a secret with `NEXT_PUBLIC_`; never log env values.

## Threat model (STRIDE, current scope)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Forged admin JWT | `SUPABASE_JWT_SECRET` set on Render (confirmed); hardening of the admin check (C3) required before public sign-ups (Phase 5). Sign-ups off until then. |
| Tampering | Writing prices with the public key | All API-role grants revoked on admin tables; RLS on with no policies; pgTAP proves insert/update/delete/truncate fail. |
| Tampering | Injected search or slug input | Zod validation in the app; regex/length checks and parameterized SQL in functions; LIKE wildcards escaped. |
| Repudiation | Unattributed clicks | Click log with opaque click ID (Phase 4). |
| Information disclosure | Reading admin tables, upload history, profiles | No grants; `catalog`/`read_model` not exposed; read functions return whitelisted columns only. |
| Information disclosure | Caching user data | Read client has no session; only anonymous catalog data is cached. Auth-aware pages will be `no-store` (Phase 5). |
| Denial of service | Expensive queries | Result caps in every function (8–100 rows); app-level data cache (5 min, tag-revalidated); rate limiting in Phase 4. |
| Elevation of privilege | `search_path` hijack in definer functions | Every new function sets `search_path = ''` and uses schema-qualified names (pgTAP-checked). |
| XSS / clickjacking | Injected script, framing | Per-request nonce CSP with `strict-dynamic`, `frame-ancestors 'none'`, no `dangerouslySetInnerHTML` (lint error). |

## Incident checklist

1. **Publishable key abused:** Settings → API Keys → create a new publishable key, update Vercel, redeploy, then delete the old key. Impact is limited to the read model.
2. **Secret key leaked (Phase 4+):** create a new secret key, update Vercel, redeploy, delete the old one, review `outbound_clicks` for anomalies.
3. **Suspected table exposure:** run the grants query from `docs/SUPABASE_SETUP_CHECKLIST.md` step 1; re-apply `002_lock_down_admin_tables.sql` (idempotent).
4. **Bad data published:** hide it with `catalog.offer_publication_overrides` or deactivate the company (`catalog.company_public_profiles.is_active = false`); no scraped data needs to change.
5. Record what happened and the fix in `docs/SECURITY_REVIEW.md`.

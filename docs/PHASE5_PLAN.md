# Phase 5 plan — email price alerts

Status: **steps 5.2–5.7 are implemented in the repo. Migration 007 has not been applied to any database.** The SQL is tested only by the in-memory pgTAP runner (`npm run test:db` in `web/`). Apply it yourself in the Supabase SQL editor when the checklist says to. Do not point the app at production alerts until that SQL and the Vercel variables are in place.

This replaces the old Phase 5 (accounts). There is no sign-up, sign-in, or profile work.

## What already exists and will be reused

The live site is `frontend/` (Next.js 14.2.35). `web/` is the earlier spec app and is not the deployed UI.

| Need | Where it is |
|---|---|
| Hebrew / English, RTL | `frontend/middleware.ts` sets `x-public-locale`. Copy lives in `frontend/lib/publicCopy.ts` and `frontend/lib/catalogCopy.ts`, not in JSON message files. Alert strings will be a new `alertsCopy` object in that same style. |
| Design tokens | `frontend/tailwind.config.ts` colors `pub.*` (`#1D4ED8`, `#0F172A`, `#475569`, `#E2E8F0`, `#F8FAFC`, `#047857`, `#ECFDF5`, `#B91C1C`). Heebo is loaded in `PublicShell`. |
| Price formatter | `frontend/lib/public/format.ts` `formatIls`. |
| Read model | `frontend/lib/public/catalog.ts`. Offers come from `public_site.offers_for`. `is_stale` is already the fresh/outdated flag (`catalog.settings.price_fresh_hours`, default 48). There is no `PRICE_FRESH_HOURS` env var. The alert job will use non-stale offers from this function and will not reimplement ranking. |
| Model page | `frontend/components/public/ModelView.tsx`. The card goes under `OfferList` when storage and condition are chosen, and the compact variant goes in the empty-offer branch. |
| Rate limit and client IP | `frontend/lib/public/rateLimit.ts`. It is an in-memory per-instance limit. Phase 5 subscribe limits must fail closed, so a missing Upstash client cannot fall back to this map. |
| Privileged client | `frontend/lib/server/privileged.ts` is the only module that reads `SUPABASE_SECRET_KEY`. Click logging and price alerts import it. Schema is `public_site`. `catalog` is not an exposed schema and must stay that way. |
| Click-route hardening | `supabase/migrations/006_outbound_clicks.sql`: RLS on, not forced, no policies, `REVOKE ALL` from `public` / `anon` / `authenticated` / `service_role`, writes only through a `read_model` `SECURITY DEFINER` function, `public_site` wrapper is `SECURITY INVOKER`. |
| Tests | `web/scripts/test-db.mjs` applies every migration to PGlite and runs `supabase/tests/*.test.sql`. There is no generated Supabase `Database` type in this repo. |

## What is not in the repo

- No Sentry. There is nothing to scrub until a Sentry SDK is added; do not log emails or tokens in the meantime.
- No nonce CSP in `frontend/`. `web/` has the spec CSP. The live app does not. Public responses set `form-action 'self'` only. See decision A8.
- Next.js 14.2.35 has no `after()`. Confirmation mail uses `waitUntil` (decision A4).
- No login or sign-up item in the public header or footer. `/login` now 404s. Admin auth (`AppShell`, `frontend/lib/api.ts`, `frontend/lib/supabase/client.ts`, `/datadmin/login`) stays.

## Schema choice

Tables live in `catalog`, same as `outbound_clicks`.

`public_site.request_price_alert` is `SECURITY INVOKER`, which is what the prompt requires and what `supabase/tests/001_privileges.test.sql` allows (`public_site` must not be definer). The body calls `read_model.request_price_alert`, which is `SECURITY DEFINER`, same as `record_click`. That is required: `service_role` has no table grant, so an invoker function could not write the rows. The secret key never receives `SELECT` on the email table.

The same pair of functions covers confirm, read (no email column), unsubscribe one, unsubscribe all, the cron claim/finish/fail path, cleanup, and suppression. They are in this migration so the email table does not need a second grant later. Tokens are not stored.

`request_price_alert` locks on the email hash, enforces the per-email cap, the 60-second resend cooldown, and the suppression list. A paused row can be confirmed again only when the cap allows it. The app passes the cap and the confirmation lifetime; the function rejects values outside a small range so a bad caller cannot set them to zero or to a huge number.

## Files in step 5.1

- `supabase/migrations/007_price_alerts.sql`
- `supabase/rollbacks/007_price_alerts.down.sql`
- `supabase/tests/004_price_alerts.test.sql`

No application code in this step. No production SQL.

## Later steps (not started)

5.2 config, normalization, tokens, `evaluateAlert`, repository, Resend/`console`/`memory`. 5.3 email templates. 5.4 the card, server action, Turnstile, rate limits, and the one `.cursor/rules/project.mdc` sentence about the secret-key module. 5.5 confirm and unsubscribe pages. 5.6 cron and webhook. 5.7 docs and the full test suite.

`/login` will stop redirecting and 404, because this prompt says that route must not exist. `/datadmin/login` stays.

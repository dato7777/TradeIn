# Cursor Prompt: PHASE 5 (replacement) — Email Price Alerts, no accounts

> Paste this whole file into Cursor (Agent mode). It **replaces "Phase 5: Auth and accounts"** of the master prompt. Phases 1–4 are done. All other master-prompt rules (security, design tokens, i18n, "never touch the admin/scrapers", additive migrations, stop-for-approval) still apply. If this file and the master prompt disagree, **this file wins for Phase 5 only**. If `docs/CURSOR_PROMPT.md` exists, read it for conventions.

---

## 0. Working rules

1. **Step 0 (read-only recon first).** Before any code, inspect the repo as it stands after Phases 1–4 and write a short plan in `docs/PHASE5_PLAN.md`: what you will **reuse** (design tokens, i18n setup, price formatter, data-access layer and read model, rate-limit helper, client-IP helper, env validation, privileged Supabase client from Phase 4, Turnstile helper if any, security-header/CSP setup, error pages), what you will **add**, files you will touch, and migration names. Do not assume file names; adapt to the existing structure and conventions.
2. **Checkpoint:** after writing the migration SQL and its pgTAP tests (step 5.1 in section 14), **STOP and show them to me**. Do not apply any migration anywhere until I approve. Apply first to a Supabase branch/staging project, never directly to production.
3. All schema changes are **additive, versioned migrations with rollback notes**. Never alter or read-modify existing admin/scraper tables. Never touch the admin app or scrapers.
4. Do not invent user-facing copy: use the strings in section 9 exactly (both languages). If a string is missing, add it following the same tone and mark it `TODO(copy)`.
5. Anything that cannot be done in code (provider account, DNS, dashboard settings) goes into `docs/ALERTS_SETUP_CHECKLIST.md` with exact steps for me.
6. Work in the order of section 14, run lint, typecheck, unit tests and build after each step, and finish with the report in section 16, then **stop**.

---

## 1. Goal and scope

**Goal:** a visitor on a phone's model page can enter **only an email address** to get an email when the **best trade-in price for the selected phone (model + storage + condition)** changes. No account, no password, no login.

**In scope:** the alert card (UI), double opt-in confirmation, scheduled price evaluation and alert emails, one-click unsubscribe, cleanup, deliverability plumbing, tests, docs.

**Out of scope. Do NOT implement:** sign-up, sign-in, Google/OAuth, passwords, sessions, profiles, saved phones, click history, delete/export-account, any `supabase.auth.*` usage, push/SMS/WhatsApp alerts, price-history charts, per-company alerts, any change to the admin app, new analytics or cookies.

## 2. Clean up leftovers of the dropped accounts feature

- Remove "Log in / Sign up" and user-menu entries from the header, mobile drawer and footer if they exist.
- Routes `/login`, `/signup`, `/auth/*`, `/reset-password`, `/account/*` must **not exist** (404). Remove them from sitemap/robots/menus/i18n files.
- If earlier phases added auth/session-refresh code (Supabase SSR auth client, session-refresh proxy logic, auth cookies), **list it in `docs/PHASE5_PLAN.md` and remove it only if nothing else depends on it**; otherwise ask me. The public site must not create sessions or set auth cookies.
- Update the one rule in `.cursor/rules/project.mdc` that says the secret key is used in "exactly one module (click logging)" to: "exactly one server-only module creates the privileged Supabase client; click logging and price alerts both import it". This is the only allowed edit to that file.
- Do not change any Supabase Auth setting (the admin may rely on it).

---

## 3. User flow (exact)

1. On `/sell/[brand]/[model]` the **PriceAlertCard** shows under the offers list. It always reflects the **currently selected storage and condition** (from the URL state). In the "no offers for this combination" empty state a **compact variant** is shown instead.
2. The user types an email and taps the button. Client-side validation runs first (localized messages).
3. A **Server Action** validates everything again, applies rate limits and Turnstile, creates or refreshes a **pending** subscription, and sends a **confirmation email** after responding. The response is **identical** for every outcome (new, already pending, already active, suppressed, capped) so addresses cannot be enumerated.
4. The email contains a link to `/alerts/confirm?token=…`. **The GET only renders a page** with a "Confirm" button. The state changes on **POST** (so email-scanner prefetch cannot confirm anything). Confirming sets the subscription **active** and stores the **baseline** (current best fresh price, or none).
5. A scheduled job evaluates active subscriptions and emails an alert when the rules in section 4 are met.
6. Every alert has a **footer unsubscribe link** and the **RFC 8058 one-click header**. The unsubscribe page offers "stop this alert" and "stop all alerts for this email".
7. A daily cleanup deletes expired pending subscriptions, expired active subscriptions and old send logs.

---

## 4. Alert rules (exact, implement as a pure, unit-tested function)

- **Current price** = the best (highest) price among offers for (model, storage, condition) from the **public read model**, counting **only fresh offers** (updated within `PRICE_FRESH_HOURS`). Offers flagged "may be outdated" or hidden are ignored. No offers = `null`.
- **Baseline** = the current price at confirmation, then the price that was last alerted. `null` if there were no offers.
- `evaluateAlert({ baseline, current, lastAlertAt, now, cfg })` returns `{ send: false, reason }` or `{ send: true, kind: 'up' | 'down' | 'available', baseline, current, deltaIls, deltaPercent }`:
  - `current == null` → don't send (`no_current`); keep the baseline.
  - `lastAlertAt` within `ALERT_COOLDOWN_HOURS` → don't send (`cooldown`); **do not move the baseline** (a change that persists past the cooldown still fires).
  - `baseline == null` and `current != null` → send `available`.
  - Otherwise send only if **both** `|delta| >= ALERT_MIN_CHANGE_ILS` **and** `|delta| / baseline * 100 >= ALERT_MIN_CHANGE_PERCENT`. `kind` is `up` or `down`. Smaller changes → `below_threshold`.
  - After a successful send: `baseline = current`, `lastAlertAt = now`.
- Prices are integer ILS. Never use floats for money; compute the percent for comparison only.
- Table-driven unit tests for: up, down, exactly-at-threshold, just-below, cooldown, null baseline, null current, price returning to baseline inside the cooldown, large and small phones.

---

## 5. Data model (additive migration; tables in the **same schema and hardening pattern as `outbound_clicks` from Phase 4**)

All new tables: **RLS enabled, no policies for `anon`/`authenticated`, `REVOKE ALL` from `anon`, `authenticated`, `PUBLIC`**, access only through the server-only privileged client. **No foreign keys to admin/raw tables.** Identify phones by the stable identifiers the public read model exposes (model slug, storage, condition) and validate them against the read model at subscribe time.

**`price_alert_subscriptions`**
- `id uuid pk default gen_random_uuid()`
- `email text not null` (normalized: trimmed, lowercased, max 254), `email_hash text not null` (HMAC-SHA256 with `ALERT_HASH_SECRET`)
- `model_slug text not null`, `storage_gb integer not null`, `condition char(1) not null check (condition in ('A','B','C','D'))`
- `locale text not null check (locale in ('he','en'))`
- `status text not null check (status in ('pending','active','paused'))`
- `pending_expires_at timestamptz`, `last_confirmation_sent_at timestamptz`
- `consent_text_version text not null`, `signup_ip_hash text` (HMAC, never a raw IP)
- `confirmed_at timestamptz`, `expires_at timestamptz`
- `baseline_price integer`, `baseline_at timestamptz`
- `last_alert_at timestamptz`, `last_alert_price integer`, `last_evaluated_at timestamptz`
- `claim_id uuid`, `claimed_at timestamptz`, `failure_count integer not null default 0`
- `created_at`, `updated_at`
- **Unique** `(email_hash, model_slug, storage_gb, condition)`; indexes for the job (`status`, `last_evaluated_at`) and cleanup (`pending_expires_at`, `expires_at`).

**`price_alert_sends`** (audit and dedupe): `id`, `subscription_id` (no FK cascade surprises; plain uuid), `kind`, `old_price`, `new_price`, `provider_message_id`, `status` (`sent`/`failed`), `created_at`. Retention 90 days.

**`email_suppressions`**: `email_hash text pk`, `reason text check (reason in ('bounce','complaint','manual'))`, `created_at`. A suppressed address never receives mail and never gets a new subscription.

**Function `request_price_alert(...)`** (`SECURITY INVOKER`, `set search_path = ''`, schema-qualified names, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`, granted only to the privileged role). It runs in one transaction with `pg_advisory_xact_lock` on the email hash and returns `{ id, outcome }`, where `outcome` is one of `created`, `pending_refreshed`, `cooldown`, `already_active`, `suppressed`, `cap_reached`. Rules: max `ALERT_MAX_PER_EMAIL` pending+active subscriptions per email; a pending subscription refreshes `pending_expires_at` but does not resend within 60 seconds (`cooldown`).

**No tokens are stored.** Tokens are **signed (HMAC) and purpose-bound** (see `alerts/tokens` in section 6).

**pgTAP tests** (`supabase/tests/`): `anon` and `authenticated` cannot select/insert/update/delete these tables or execute the function; the privileged role can; unique constraint and per-email cap hold under concurrent calls; suppressed emails are refused; condition/locale/status checks reject bad values.

---

## 6. Server design (all under `import 'server-only'`, no Supabase calls inside UI components)

- `alerts/config`: parse the alert env vars with Zod once; export typed config.
- `alerts/email`: `normalizeEmail()` (trim, lowercase, reject control characters/spaces/newlines, max 254, ASCII-only local part; convert an internationalized domain to punycode; keep `+tags` and dots as typed) and `hashEmail()`.
- `alerts/tokens`: `signToken(purpose, id, exp?)` and `verifyToken()` using HMAC-SHA256 with `ALERT_TOKEN_SECRET`, base64url, **constant-time comparison**, purposes `confirm` (carries an expiry of `ALERT_CONFIRM_TTL_HOURS`) and `manage` (no expiry, because unsubscribe links must work forever). Format: `<id>.<exp|0>.<mac>`, where the MAC covers `purpose|id|exp`. Accept `ALERT_TOKEN_SECRET_PREVIOUS` when set, so rotation does not break old unsubscribe links.
- `alerts/evaluate`: the pure function from section 4.
- `alerts/repository`: the only place that talks to the new tables (via the existing privileged client module).
- `alerts/service`: `subscribe()`, `confirm()`, `unsubscribe(one|all)`, `runEvaluation()`, `runCleanup()`.
- `email/provider`: an `EmailProvider` interface (`send({to, from, replyTo, subject, html, text, headers, idempotencyKey})`) with **Resend as the default implementation**, plus `console`/`memory` providers for local, preview and tests. **Real sending is production-only**; local and preview use `console`/`memory` unless `EMAIL_ALLOW_REAL_SEND_NON_PROD=true`. Turn **click tracking off** at the provider (it rewrites links and hurts trust). Use the provider's idempotency key if supported.
- Read prices through the **existing data-access layer / read model**. Do not duplicate ranking or freshness logic.

**Server Action `subscribeToPriceAlert`** (same-origin is enforced by Next; do not loosen `allowedOrigins`):
1. Zod-validate `{ email, modelSlug, storage, condition, locale, turnstileToken, website }` (`website` is the honeypot; if non-empty, return the normal success response and do nothing).
2. Rate limits (section 7), then Turnstile verification, then validate the phone against the read model (unknown model/storage/condition → generic validation error).
3. `request_price_alert(...)`. For `created` / `pending_refreshed`, build the confirm link and send the confirmation email **after the response** (`after()` from `next/server`, or the closest equivalent in the installed Next version), so timing does not reveal the outcome.
4. Always return the same success shape. Never throw raw errors to the client; return a discriminated union (`ok` | `invalid_email` | `rate_limited` | `error`).

**Pages** (server components, locale-aware, `noindex`): `/alerts/confirm` and `/alerts/unsubscribe`. GET renders; state changes happen in Server Actions (POST).

**`POST /api/alerts/unsubscribe`** (RFC 8058 one-click): accepts the `manage` token as a query param and the body `List-Unsubscribe=One-Click`, unsubscribes that one subscription immediately, returns 200 (idempotent), `GET` returns 405. Excluded from i18n routing. Rate limited.

**`GET /api/cron/price-alerts?task=evaluate|cleanup`**: requires `Authorization: Bearer ${CRON_SECRET}` (constant-time compare; 401 with an empty body otherwise), `dynamic = 'force-dynamic'`, sets `maxDuration`, returns JSON counts only (no PII).
- **evaluate**: pick active subscriptions ordered by `last_evaluated_at asc nulls first`, up to `ALERT_BATCH_SIZE`; group by (model, storage, condition) and fetch each distinct price **once**; set `last_evaluated_at`; for each subscription that passes `evaluateAlert`, **claim it atomically** (`update … set claim_id = $new, claimed_at = now() where id = $id and status = 'active' and (claim_id is null or claimed_at < now() - interval '10 minutes') and (last_alert_at is null or last_alert_at <= now() - cooldown) returning …`), send the email, then on success set `baseline_price`, `last_alert_at`, `last_alert_price`, `expires_at = now() + ALERT_RETENTION_DAYS`, clear the claim, reset `failure_count`, and insert into `price_alert_sends`; on failure clear the claim and increment `failure_count`, and after `ALERT_MAX_FAILURES` consecutive failures set `status = 'paused'`. Skip suppressed addresses. Stop at ~80% of `maxDuration`; the rest is picked up next run.
- **cleanup** (daily): delete pending past `pending_expires_at`, delete active past `expires_at`, delete `price_alert_sends` older than 90 days.
- Add `vercel.json` crons (evaluate every few hours, cleanup daily). **Check Vercel's current cron limits for my plan** (the free plan is limited to infrequent runs) and document the result and the options in the checklist. **Do not add any admin-to-public endpoint in this phase.**

**`POST /api/webhooks/email`** (provider bounce/complaint events): verify the provider's signature using the provider's documented method (look up current docs; do not hand-roll crypto if an official helper exists), Zod-parse, idempotent. On a hard bounce or complaint: insert into `email_suppressions` and delete that address's subscriptions. Return 200 fast; 401 on a bad signature.

---

## 7. Security requirements specific to this phase

- **No enumeration:** identical response body, status and (via `after()`) similar timing for every subscribe outcome. Never say "already subscribed".
- **Mail-bombing / abuse limits** (Upstash, keys use hashed identifiers, never raw emails; **fail closed** on subscribe if Redis is unavailable): per IP 5 per 10 minutes and 20 per day; per email hash 3 per hour; confirmation resend cooldown 60 seconds; global circuit breaker `ALERT_MAX_CONFIRMATIONS_PER_DAY` (when hit: generic "try later" and a monitoring alert). Rate limit the confirm/unsubscribe/one-click routes too (30 per 10 minutes per IP). Return `429` with `Retry-After` where applicable.
- **Bot protection:** Cloudflare Turnstile in `interaction-only` appearance on the form. Verify server-side (`success`, expected `hostname`, expected `action = "price-alert"`; tokens are single-use). Load the Turnstile script **lazily** (on first focus or when the card enters the viewport) so Lighthouse scores are not hurt. Plus the honeypot field. In tests use Cloudflare's **documented test keys** (look them up in the Cloudflare docs, do not guess).
- **Tokens in URLs:** token pages send `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex` and load no third-party resources. Never log tokens or full emails (log the first 8 characters of the email hash). Sentry scrubbing must cover emails and tokens.
- **Emails:** escape every interpolated value (model names come from the database); build links only from `NEXT_PUBLIC_SITE_URL` + locale + known paths; no user-controlled redirect parameters anywhere; reject CR/LF in anything that reaches a header (subject, to, from, reply-to).
- **CSP:** keep the nonce-based CSP; add only what Turnstile needs (script, frame, connect for `challenges.cloudflare.com`) and `form-action 'self'`. Verify, do not loosen anything else.
- **Cron and webhook auth** as in section 6. A request without valid auth must reveal nothing.
- **PII:** email is stored in plaintext in a private table (needed to send); document in `docs/SECURITY.md` why column-level encryption was deferred. Hash everything else. Delete the email when the subscription is removed. No raw IPs.
- Update the `docs/SECURITY.md` threat model with rows for: mail bombing, enumeration, token leakage via Referer, scanner prefetch, forged webhooks, cron abuse, PII at rest, duplicate sends.

---

## 8. UI design (bright, white, trustworthy; reuse existing tokens)

Use the existing design tokens from Phase 1 (primary `#1D4ED8`, text `#0F172A`, muted `#475569`, border `#E2E8F0`, surface `#F8FAFC`, positive `#047857` on `#ECFDF5`, error `#B91C1C`, radius 12 px cards / 10 px inputs, Heebo font). Add only what is missing: `--primary-tint: #EFF6FF` and `--primary-tint-border: #BFDBFE`. **Verify every text/background pair meets WCAG AA.**

**PriceAlertCard** (client island inside the server-rendered, cacheable model page; it must not make the page dynamic, must not shift layout on load, and must have `id="price-alert"` and `scroll-margin-top` for the sticky header)

```
Mobile (320–639 px)                       Tablet/Desktop (≥640 px)
┌───────────────────────────┐             ┌──────────────────────────────────────────────┐
│ (bell) Title              │             │ (bell)  Title                                │
│ Subtitle                  │             │         Subtitle                             │
│ [model · storage · cond.] │             │         [model · storage · condition]        │
│ ┌───────────────────────┐ │             │ ┌──────────────────────────┐ ┌─────────────┐ │
│ │ Your email            │ │             │ │ Your email               │ │  Alert me   │ │
│ └───────────────────────┘ │             │ └──────────────────────────┘ └─────────────┘ │
│ ┌───────────────────────┐ │             │ consent microcopy …                          │
│ │      Alert me         │ │             └──────────────────────────────────────────────┘
│ └───────────────────────┘ │             (≥1024 px: two columns inside the 1200 px container:
│ consent microcopy …       │              text left, form right; mirrored automatically in RTL)
└───────────────────────────┘
```

- Card: `--primary-tint` background, `--primary-tint-border` border, 12 px radius, `shadow-sm`, padding 16 px (mobile) / 24 px (≥640). Bell icon in a white circle with a primary-colored icon (Lucide `Bell`). Title 18 px (20 px ≥640) semibold; subtitle muted 14–15 px; consent microcopy muted 12–13 px.
- Selection chip: white pill with border; `min-w-0`, single line with ellipsis and a `title` attribute; the numbers (storage) in `tabular-nums`. It updates live when the user changes storage/condition above.
- Input: `type="email"`, `name="email"`, `autocomplete="email"`, `inputMode="email"`, `enterKeyHint="send"`, **`dir="auto"`** (so Latin addresses type left-to-right inside the RTL page), height **48 px**, 10 px radius, visible focus ring. Button: height **48 px**, primary blue, white text, `min-width: 8.5rem`, full width on mobile. The visually hidden `<label>` is required (placeholder alone is not a label).
- This button is **secondary in importance** to the green "Go to offer" CTA: never use the green on it.
- Logical properties only (`ms-/me-/ps-/pe-/text-start`); the bell does not flip; any arrow-like icon does.
- Header shortcut: a small text button with a bell icon ("Alert me" / localized) in the offers header that links to `#price-alert`.
- **Compact variant** (empty state): no subtitle, one line of text plus the same form.

**States** (all localized, no layout jump larger than the card itself):
- *Idle*; *focus*; *validation error* (shown on submit or blur, never per keystroke; `aria-invalid`, error linked by `aria-describedby`); *submitting* (spinner, button disabled but still announced, `aria-busy`); *rate-limited* and *generic error* (banner inside the card, retry possible); *success*.
- *Success* replaces the form with a green check badge, "Check your inbox", the address inside `<bdi dir="ltr">`, the spam-folder hint, a **Resend** button with a 60-second visible countdown (rate-limited server-side), and "Use a different email". Move focus to the success heading (`tabIndex={-1}`) and announce through an `aria-live="polite"` region. Respect `prefers-reduced-motion` (no animation when reduced).

**Confirm and unsubscribe pages:** centered card (`max-w-md`), icon, `h1`, the selection chip, one full-width primary button on mobile, a secondary text link "Back to site". States: ready, success, already-done, invalid/expired. Unsubscribe shows two buttons ("Stop this alert" primary, "Stop all alerts for this email" outline). Reuse the standard header/footer.

**Responsive verification:** 320, 360, 375, 414, 768, 1024, 1280, 1536 px, in **Hebrew RTL and English LTR**; no horizontal scroll; touch targets at least 44 px; usable at 200% text zoom and in 320 px reflow; keyboard-only operation; screen-reader check of the success announcement.

---

## 9. Copy (use exactly; keep in the existing message files under an `alerts` namespace)

| Key | English | עברית |
|---|---|---|
| title | Alert me when the price changes | קבלו התראה כשהמחיר משתנה |
| subtitle | We'll email you when the best price for your phone changes. No account needed. | נשלח לכם אימייל כשהמחיר הטוב ביותר למכשיר שלכם ישתנה. בלי הרשמה ובלי סיסמה. |
| selection | {model} · {storage} · Condition {grade} | {model} · {storage} · מצב {grade} |
| emailLabel | Email address | כתובת אימייל |
| emailPlaceholder | Your email | האימייל שלכם |
| submit | Alert me | עדכנו אותי |
| submitting | Sending… | שולחים… |
| headerShortcut | Alert me | עדכנו אותי |
| consent | By continuing you agree to receive price alerts for this phone by email. We'll send a confirmation link first. You can unsubscribe at any time. See our {privacyLink}. | בהמשך אתם מאשרים קבלת התראות מחיר למכשיר זה באימייל. קודם נשלח קישור אישור. אפשר להסיר את עצמכם בכל רגע. מידע נוסף: {privacyLink}. |
| privacyLink | Privacy Policy | מדיניות הפרטיות |
| errorInvalid | Please enter a valid email address. | אנא הזינו כתובת אימייל תקינה. |
| errorRate | Too many attempts. Please try again in a few minutes. | יותר מדי ניסיונות. נסו שוב בעוד כמה דקות. |
| errorGeneric | Something went wrong. Please try again. | משהו השתבש. נסו שוב. |
| successTitle | Check your inbox | בדקו את תיבת הדואר |
| successBody | We sent a confirmation link to {email}. Open it to start receiving alerts. | שלחנו קישור אישור אל {email}. לחצו עליו כדי להתחיל לקבל התראות. |
| successHint | Can't find it? Check your spam folder. | לא מוצאים? בדקו בתיקיית הספאם. |
| resend | Resend email | שליחה מחדש |
| resendIn | Resend in {seconds}s | שליחה מחדש בעוד {seconds} שניות |
| changeEmail | Use a different email | להשתמש באימייל אחר |
| emptyTitle | No offers right now. Get an alert when one appears. | אין הצעות כרגע. קבלו התראה כשתופיע הצעה. |
| confirmTitle | Confirm your price alert | אישור התראת מחיר |
| confirmBody | You're about to start receiving alerts for: | אתם עומדים להתחיל לקבל התראות על: |
| confirmButton | Confirm alert | אישור התראה |
| confirmDone | Your alert is on! We'll email you when the best price changes. | ההתראה פעילה! נעדכן אתכם באימייל כשהמחיר הטוב ביותר ישתנה. |
| confirmAlready | This alert is already confirmed. | ההתראה כבר אושרה. |
| linkInvalid | This link is invalid or has expired. | הקישור אינו תקף או שפג תוקפו. |
| backToSite | Back to the site | חזרה לאתר |
| unsubTitle | Stop price alerts | הפסקת התראות מחיר |
| unsubOne | Stop this alert | הפסקת ההתראה הזו |
| unsubAll | Stop all alerts for this email | הפסקת כל ההתראות לכתובת הזו |
| unsubDoneOne | Done. You won't get alerts for this phone anymore. | בוצע. לא תקבלו יותר התראות על המכשיר הזה. |
| unsubDoneAll | Done. All alerts for this email have been stopped. | בוצע. כל ההתראות לכתובת זו הופסקו. |

Hebrew copy uses gender-neutral plural forms. Render prices with the existing ILS formatter. Show emails inside `<bdi dir="ltr">`.

---

## 10. Emails (React Email, rendered to HTML + plain text, tested in both languages)

- **Two templates:** *confirmation* and *price alert*. Locale = the locale stored with the subscription. `<html lang dir>` and table `dir` set (`rtl` for Hebrew, with right alignment). Direction-sensitive glyphs flip: "was → now" uses `→` in English and `←` in Hebrew.
- **Design:** light only, explicit text and background colors on every element (stays readable if a client forces dark mode). Outer background `#F8FAFC`, a centered **600 px** white card (12 px radius, 24 px padding), site name as a text wordmark (from config, not hard-coded; no remote images, no tracking pixels), system font stack with Arial fallback (Hebrew renders fine). Phone chip, a large price block, a "bulletproof" button (padding on the `<a>`, `bgcolor` fallback), small muted footer. Keep the HTML well under 100 KB (avoids Gmail clipping). Valid on a 320 px viewport (single column, fluid).
- **Alert email content:** badge ("Price went up" green `#047857` on `#ECFDF5`, "Price went down" amber `#B45309` on `#FFFBEB`, or "Offers available"), the phone chip, `was ₪X → now ₪Y` with the amount and percent change, the **top 3 current offers** (company and price), one button "See all offers" / "לכל ההצעות" linking to the **model page** (not `/go`, so email scanners cannot create phantom click-outs) with `?storage=…&condition=…&utm_source=price-alert&utm_medium=email&utm_campaign=alert`, the disclaimer "Prices are indicative; the final price is set by the company after inspection." (translate for Hebrew), and the footer.
- **Footer (both emails):** site name, why they got it ("You asked for price alerts for {phone}"), the unsubscribe link, and the reply-to contact. Alert emails also state that alerts stop automatically if there is no activity for 12 months.
- **Subjects:** confirmation: `Confirm your price alert` / `אשרו את התראת המחיר שלכם`. Alert: `{model}: best price rose to ₪{new}` / `…dropped to ₪{new}` / `{model}: offers are now available from ₪{new}`; Hebrew: `{model}: המחיר הטוב ביותר עלה ל‑₪{new}` / `…ירד ל‑₪{new}` / `{model}: יש עכשיו הצעות, החל מ‑₪{new}`. No line breaks, no email address in the subject.
- **Confirmation body (EN):** "You asked to be alerted when the best price for selling this phone changes: {phone}. The best price right now is {price}. [Confirm alert] If you didn't request this, ignore this email; no alerts will be sent. This link expires in {hours} hours." **(HE):** "ביקשתם לקבל התראה כשהמחיר הטוב ביותר למכירת המכשיר ישתנה: {phone}. המחיר הטוב ביותר כרגע: {price}. [אישור התראה] אם לא ביקשתם זאת, אפשר להתעלם מההודעה, ולא תישלח אליכם התראה. הקישור תקף ל־{hours} שעות."
- **Headers on alert emails:** `List-Unsubscribe: <https://…/api/alerts/unsubscribe?token=…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (https only; the provider must DKIM-sign these headers). `From` name = site name, `Reply-To` = `EMAIL_REPLY_TO`.
- **Legal flag:** add `ALERT_AD_LABEL_ENABLED` (default `false`). When `true`, Hebrew subjects get the prefix `פרסומת: ` and English subjects `Ad: `. Mark `TODO(legal)`: whether Israeli anti-spam rules require such a label for these alerts is for my lawyer to decide; do not make legal claims in code comments or docs.
- Provide `npm run email:preview`, which renders every template in both languages and several price cases into a git-ignored `.email-preview/` folder so I can open them in a browser.
- Add snapshot tests of the rendered HTML and text for both locales, plus an assertion that RTL attributes are present.

---

## 11. Environment variables (validate with Zod at boot; update `.env.example`; never commit values)

| Variable | Purpose / default |
|---|---|
| `EMAIL_PROVIDER` | `resend` in production; `console` locally and in preview |
| `RESEND_API_KEY` | server only |
| `EMAIL_FROM` | e.g. `SiteName <alerts@mail.<domain>>` (use a **sending subdomain**) |
| `EMAIL_REPLY_TO` | monitored address |
| `EMAIL_WEBHOOK_SECRET` | provider webhook signing secret |
| `EMAIL_ALLOW_REAL_SEND_NON_PROD` | `false` |
| `ALERT_HASH_SECRET` | HMAC for email/IP hashes |
| `ALERT_TOKEN_SECRET`, `ALERT_TOKEN_SECRET_PREVIOUS` | signed tokens (previous is optional) |
| `CRON_SECRET` | Bearer secret for the cron route |
| `ALERT_MIN_CHANGE_ILS` | `30` |
| `ALERT_MIN_CHANGE_PERCENT` | `3` |
| `ALERT_COOLDOWN_HOURS` | `24` |
| `ALERT_BATCH_SIZE` | `200` |
| `ALERT_MAX_PER_EMAIL` | `5` |
| `ALERT_MAX_FAILURES` | `5` |
| `ALERT_CONFIRM_TTL_HOURS` | `48` |
| `ALERT_RETENTION_DAYS` | `365` |
| `ALERT_MAX_CONFIRMATIONS_PER_DAY` | `2000` |
| `ALERT_AD_LABEL_ENABLED` | `false` |

Existing variables are reused (`NEXT_PUBLIC_SITE_URL`, Supabase keys, Upstash, Turnstile, `PRICE_FRESH_HOURS`, Sentry). The site name and domain are not decided yet: read them from config, never hard-code them.

---

## 12. Privacy (build the plumbing; I will get the texts reviewed)

- The site sets **no cookies of its own** in this phase. Document any storage Turnstile uses in `docs/PRIVACY_NOTES_ALERTS.md`.
- If `/privacy` exists, add a clearly marked draft paragraph (`TODO(legal)`) about alert emails; if it does not exist yet, write the paragraph in `docs/PRIVACY_NOTES_ALERTS.md` for Phase 6. Include: what is stored (email, phone choice, language, consent version, hashed IP, timestamps), why, retention (pending 48 hours; active until unsubscribe or 12 months without an alert; send logs 90 days), who processes it (email provider, hosting, database), and how to unsubscribe.
- Consent proof = the double opt-in: store `consent_text_version` and `confirmed_at`. Keep the consent text in one versioned constant.

---

## 13. Tests and CI

- **Unit (Vitest):** email normalization/validation (case, spaces, plus-tags, IDN domain, newline injection, over-length), HMAC hashing, token sign/verify (tamper, wrong purpose, expired confirm, rotated secret, non-expiring manage token), `evaluateAlert` table, link builder (locale prefix, no PII, no open redirect), Turnstile verifier (success, wrong hostname, wrong action), template rendering for both locales.
- **Database (pgTAP):** section 5.
- **Integration:** the subscribe action returns an identical shape for new / pending / active / suppressed / capped emails; rate limits return `429`; the cron route returns `401` without the secret; running the job twice in a row sends nothing the second time; **two concurrent job invocations never double-send**; failures pause a subscription after `ALERT_MAX_FAILURES`; webhook signature rejection and idempotent suppression.
- **E2E (Playwright, `memory` email provider and Turnstile test keys):** pick a model → change storage/condition → the chip updates → submit → success state → read the captured confirmation email → open the link → press Confirm → seed a price change → run the cron route → the alert email arrives → the one-click unsubscribe POST works → no further emails. Run the whole flow in **Hebrew and English**.
- **Responsive/visual:** screenshots of the card (idle, error, success, compact) and of the confirm/unsubscribe pages at 320, 375, 768, 1280 px in RTL and LTR; **axe** on the model page with the card and on both token pages (no serious/critical issues); Lighthouse CI on the model page must still meet the master targets (the Turnstile script must not load before interaction).
- **CI:** all of the above plus `npm audit --omit=dev` and `gitleaks`.

---

## 14. Implementation order

- **5.0** Recon and `docs/PHASE5_PLAN.md` (section 0).
- **5.1** Migration + pgTAP tests, rollback notes, regenerated types. **STOP for my approval before applying (section 0.2).**
- **5.2** Config/env, email normalization, tokens, `evaluateAlert`, repository/service, email provider interface + `console`/`memory`/Resend, with unit tests.
- **5.3** Email templates + `email:preview` + snapshot tests.
- **5.4** Subscribe Server Action, rate limits, Turnstile, `PriceAlertCard` (all states, both languages, responsive), header shortcut, empty-state variant, removal of the account leftovers (section 2).
- **5.5** Confirm and unsubscribe pages, one-click route, headers/CSP/robots/sitemap updates.
- **5.6** Cron route (evaluate + cleanup), `vercel.json`, webhook route.
- **5.7** Full test suite, docs (`docs/ALERTS.md`, `docs/ALERTS_SETUP_CHECKLIST.md`, `docs/PRIVACY_NOTES_ALERTS.md`, updates to `docs/SECURITY.md`, `docs/DECISIONS.md`, `.env.example`).

`docs/ALERTS_SETUP_CHECKLIST.md` must contain exact steps for me: create the email-provider account; verify a **sending subdomain** with SPF, DKIM and DMARC (start `p=none`, then tighten) and follow Gmail/Yahoo bulk-sender guidance (authentication, one-click unsubscribe, low complaint rate); create the webhook and copy its secret; create the Turnstile widget and keys; set every variable in Vercel scoped correctly (production vs preview) and generate secrets with a strong random generator; confirm Vercel cron limits for my plan; send a real test to Gmail, Outlook and Yahoo inboxes and check the spam folder; until the production domain exists, use the provider's test sender in non-production only.

---

## 15. Definition of done

- [ ] No accounts, no auth routes, no auth cookies; header/footer have no login/sign-up entries
- [ ] One email field + button; works at 320–1536 px in Hebrew RTL and English LTR; touch targets ≥ 44 px; axe clean
- [ ] Double opt-in; confirm and unsubscribe change state only on POST; one-click unsubscribe works and is idempotent
- [ ] Identical subscribe responses for every outcome; all abuse limits, Turnstile and honeypot active; fail-closed on rate-limit outage
- [ ] New tables unreachable by `anon`/`authenticated` (pgTAP proves it); secret key still created in exactly one server-only module
- [ ] Alert rules match section 4 and the unit table passes; cron route is authenticated, idempotent and safe under concurrency
- [ ] Emails render correctly in both languages (RTL verified), include the List-Unsubscribe headers, contain no remote images or tracking
- [ ] No PII in logs, URLs or Sentry; tokens never logged; token pages send no-referrer and are noindex
- [ ] Lighthouse/Core Web Vitals targets still met; the model page is still cacheable
- [ ] Docs complete: PHASE5_PLAN, ALERTS, ALERTS_SETUP_CHECKLIST, PRIVACY_NOTES_ALERTS, SECURITY (updated), DECISIONS (updated), `.env.example`

## 16. Final report (then STOP)

Report: what changed (files and migrations), tests run and results, security checks performed, deviations from this prompt with reasons, open risks, `TODO(copy)` / `TODO(legal)` items, and exactly what I must do manually (the checklist items). Wait for my approval before Phase 6.

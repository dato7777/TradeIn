# Price alerts — setup checklist

Do these in order. Do not paste secrets into chat. The migration is not applied yet.

## 1. Database

In the Supabase SQL editor, run `supabase/migrations/007_price_alerts.sql` once. If `006_outbound_clicks.sql` is not applied yet, run that first.

This project has no staging database. The SQL was checked with `npm run test:db` in `web/` (PGlite only).

## 2. Email provider (Resend)

1. Create a Resend account.
2. Add a **sending subdomain**, for example `mail.yourdomain.com`. Do not send from the naked domain you will use for the website.
3. Add the DNS records Resend shows you:
   - SPF on that subdomain
   - DKIM (the CNAMEs or TXT records Resend gives you)
   - DMARC on the organizational domain, starting at `p=none` (`v=DMARC1; p=none; rua=mailto:you@yourdomain.com`). Tighten to `p=quarantine` and then `p=reject` after you have watched real mail for a while.
4. Gmail and Yahoo bulk-sender guidance: authenticate with SPF, DKIM, and DMARC; keep a one-click unsubscribe header (the app adds it); keep the complaint rate low.
5. In the domain settings, turn **click tracking** and **open tracking** off. Tracking rewrites links.
6. Create an API key. Put it in Vercel as `RESEND_API_KEY` (Sensitive). Do not prefix it with `NEXT_PUBLIC_`.
7. Set `EMAIL_FROM` to the address on the sending subdomain, for example `alerts@mail.yourdomain.com`. The app puts the site name in the From display name.
8. Set `EMAIL_REPLY_TO` to a mailbox you actually read.
9. Add a webhook: URL `https://YOUR_SITE/api/webhooks/email`, events **email.bounced** and **email.complained**. Copy the signing secret (`whsec_...`) to `EMAIL_WEBHOOK_SECRET`.

Until the real domain exists, leave `EMAIL_PROVIDER` unset or set it to `console` on preview deployments. Real sends happen only when `NODE_ENV` is production, unless you set `EMAIL_ALLOW_REAL_SEND_NON_PROD=true` (leave that `false`).

## 3. Turnstile

1. In Cloudflare, create a Turnstile widget. Appearance: interaction only. Allowed hostnames: your production host, and preview hosts if you want the form to work there.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key (this one is public).
3. Set `TURNSTILE_SECRET_KEY` to the secret key (Sensitive, not `NEXT_PUBLIC_`).
4. Optional: `TURNSTILE_ALLOWED_HOSTS` is a comma-separated list of extra hostnames the server will accept in the Turnstile response.

Local and automated tests use Cloudflare's dummy keys, not the production keys:

| Role | Always passes | Always fails | Interactive |
|---|---|---|---|
| Site key | `1x00000000000000000000AA` | `2x00000000000000000000AB` | `3x00000000000000000000FF` |
| Secret | `1x0000000000000000000000000000000AA` | `2x0000000000000000000000000000000AA` | — |

The third dummy secret, `3x0000000000000000000000000000000AA`, means "token already spent".

## 4. Upstash

Create a Redis database. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both Sensitive).

If those are missing, subscribe fails closed. For local development only, you may set `ALERT_RATE_LIMIT=memory`. That value is ignored in production.

## 5. Vercel environment

Project root must be `frontend` so `frontend/vercel.json` is the cron file.

Generate each secret with `openssl rand -base64 32`. Set them as Sensitive. Do not prefix them with `NEXT_PUBLIC_`.

| Name | Notes |
|---|---|
| `EMAIL_PROVIDER` | `resend` in production. Preview can stay `console`. |
| `RESEND_API_KEY` | From step 2. |
| `EMAIL_FROM` | Address on the sending subdomain. |
| `EMAIL_REPLY_TO` | Monitored mailbox. |
| `EMAIL_WEBHOOK_SECRET` | Webhook signing secret. |
| `EMAIL_ALLOW_REAL_SEND_NON_PROD` | `false` |
| `ALERT_HASH_SECRET` | HMAC for email and IP. |
| `ALERT_TOKEN_SECRET` | HMAC for confirm and unsubscribe links. |
| `ALERT_TOKEN_SECRET_PREVIOUS` | Optional. Set only while rotating. |
| `CRON_SECRET` | Vercel sends this as `Authorization: Bearer` when the variable is named `CRON_SECRET`. |
| `ALERT_MIN_CHANGE_ILS` | `30` |
| `ALERT_MIN_CHANGE_PERCENT` | `3` |
| `ALERT_COOLDOWN_HOURS` | `24` |
| `ALERT_BATCH_SIZE` | `200` |
| `ALERT_MAX_PER_EMAIL` | `5` |
| `ALERT_MAX_FAILURES` | `5` |
| `ALERT_CONFIRM_TTL_HOURS` | `48` |
| `ALERT_RETENTION_DAYS` | `365` |
| `ALERT_MAX_CONFIRMATIONS_PER_DAY` | `2000` |
| `ALERT_AD_LABEL_ENABLED` | `false` until a lawyer says otherwise. `TODO(legal)`. |
| `NEXT_PUBLIC_SITE_URL` | `https://` plus the public origin. Links are built only from this. |
| `SUPABASE_SECRET_KEY` | The existing `sb_secret_` key. Same one as click logging. Do not create a second key. |

Also set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and the two Upstash variables.

Scope production and preview separately. Preview should not use the production Resend key unless you intend to send real mail from preview.

## 6. Cron limits (checked October 2026)

Vercel Hobby: cron jobs may run **once per day**. A schedule such as `0 */4 * * *` fails the deploy. Timing on Hobby is only guaranteed within that UTC hour.

This repo therefore uses:

- evaluate: `0 6 * * *` (once a day, during the 06:00 UTC hour)
- cleanup: `0 7 * * *`

`maxDuration` on the route is **10 seconds**, which is the Hobby function limit. The job stops at about 80% of that.

On Pro you can:

- change evaluate to `0 */4 * * *` (every 4 hours)
- raise `maxDuration` in `frontend/app/api/cron/price-alerts/route.ts` from `10` to `60` (or higher if the plan allows)

There is no admin-to-public endpoint. Do not add one.

## 7. Inbox test

After the domain is verified and the variables are deployed:

1. Subscribe on a real model page with a Gmail address, then Outlook, then Yahoo.
2. Open the confirmation link and press the confirm button. Check that a prefetch of the link did not confirm it by itself.
3. Wait for the daily cron, or call the evaluate URL yourself with `Authorization: Bearer $CRON_SECRET`.
4. Confirm the alert email is not in spam, the button opens the model page (not `/go`), and the unsubscribe header is present.
5. Use the one-click unsubscribe and confirm a second send does not happen.

## 8. Local preview of the templates

From `frontend/`: `npm run email:preview`. Open the HTML files in `frontend/.email-preview/` (git-ignored).

# Price alerts

A visitor on a model page can leave an email address and be mailed when the best trade-in price for that model, storage, and condition changes. There is no account.

## Flow

1. The card on `/sell/[brand]/[model]` (and the English `/en/...` page) posts to the `subscribeToPriceAlert` server action.
2. The action checks the honeypot, rate limits, Turnstile, and that the phone exists in the read model. It then calls `public_site.request_price_alert`.
3. For a new or refreshed pending row, the confirmation email is sent after the response. Every stored outcome returns the same success shape.
4. The confirmation link opens `/alerts/confirm` (or `/en/alerts/confirm`). The page only renders. The button POSTs and sets the row active, with the current fresh price as the baseline.
5. `GET /api/cron/price-alerts?task=evaluate` loads due subscriptions, reads fresh offers through the existing catalog layer, and sends when `evaluateAlert` says so.
6. Each alert email includes an unsubscribe link and a `List-Unsubscribe` header. `POST /api/alerts/unsubscribe` performs the one-click removal. The page also offers "stop this alert" and "stop all alerts for this email".
7. `GET /api/cron/price-alerts?task=cleanup` deletes expired pending rows, expired active rows, and send logs older than 90 days.

## Rules

The current price is the highest offer for that phone whose `is_stale` flag is false. No fresh offer means no current price.

A message is sent only when there is a current price, the cooldown has passed, and either there was no baseline (offers became available) or the change is at least both `ALERT_MIN_CHANGE_ILS` and `ALERT_MIN_CHANGE_PERCENT`. After a successful send the baseline becomes that price.

## Where the code lives

| Piece | Path |
|---|---|
| Rules, tokens, mail, subscribe | `frontend/lib/alerts/` |
| Secret-key client | `frontend/lib/server/privileged.ts` |
| Card | `frontend/components/public/PriceAlertCard.tsx` |
| Confirm / unsubscribe pages | `frontend/app/(he)/alerts/` and `frontend/app/(en)/en/alerts/` |
| Cron, webhook, one-click | `frontend/app/api/` |
| SQL | `supabase/migrations/007_price_alerts.sql` |

Copy is in `frontend/lib/alertsCopy.ts`. The consent version stored with each row is `alerts-v1`.

## What you still do by hand

`docs/ALERTS_SETUP_CHECKLIST.md`. The migration is not applied to the hosted database from this repo.

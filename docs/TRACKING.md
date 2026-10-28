# Tracking

How a click on **Go to offer** is attributed. UTM parameters identify the visit. They do not by themselves mean the company owes a commission. Credit for a completed trade-in needs an agreement with that company, plus either an affiliate ID in the link or a later postback. Postbacks are not built yet.

## What the visitor does

The offer card links to `/go/{offerRef}`. `offerRef` is 24 hex characters derived from the company, model, storage and condition. It is not a row id, so it stays the same when a scrape replaces the price row.

`GET /go/{offerRef}`:

1. Ignores `HEAD` and prefetch requests. Those are not logged and do not redirect.
2. Rate-limits real clicks to 30 a minute per IP on one server instance. Over the limit, the response is `429` with `Retry-After`.
3. Loads the offer with the secret key. The destination and the price come from the database. A destination or a price in the query string is ignored.
4. Checks the destination again in the app: `https` only, no userinfo, no port, and the host must be exactly one of that company's `allowed_hosts`. Anything else is a 404. The visitor is not sent anywhere.
5. Adds the parameters below and responds with **302**. The browser still sends a referrer because the link is `rel="sponsored nofollow noopener"` and does not use `noreferrer`.
6. Writes one row to `catalog.outbound_clicks`. If that write fails, the visitor is still redirected.

An unknown offer, or a company with no allowlisted destination, returns a short page that links back to the comparison. It does not return a server error page.

## URL format

Existing query parameters on the company's destination are kept. These parameters are then set:

| Parameter | Value |
|---|---|
| `utm_source` | `TRACKING_UTM_SOURCE`, or the company's `utm_source_override` when one is set. Default `resparts`. |
| `utm_medium` | `comparison` |
| `utm_campaign` | `tradein-apple` or `tradein-samsung` |
| `utm_content` | `{model-slug}_{storage-gb}_{grade}` for example `iphone-15-pro-max_256_A` |
| click id | A new UUID v7, in the company's `click_id_param`. When that column is empty, the name is `click_id`. |

`tracking_mode`:

- `utm_only` — the parameters above only.
- `affiliate_params` — the same, plus `static_params` (for example an affiliate id the company gave you).
- `s2s` — the same as `affiliate_params`. Reserved for a future server-to-server postback. The postback endpoint is not active.

No email, user id, or IP is placed in the URL. The click id is opaque.

Sample, for KSP with the default click-id name:

```text
https://ksp.co.il/kspTradeIn/?utm_source=resparts&utm_medium=comparison&utm_campaign=tradein-apple&utm_content=iphone-15-pro-max_256_A&click_id=018f3e6a-7b2c-7d4e-8f01-23456789abcd
```

The real KSP, Pelephone and Dynamica rows already have an `https` destination and an allowlist. Their `tracking_mode` is `utm_only` and `click_id_param` is empty, so the sample shape above is what they receive. Partner has no destination, so it still produces no offers.

## Paragraph you can send a company

Hebrew:

> אנחנו מפנים אליכם גולשים מעמוד השוואת טרייד-אין. כל לחיצה מגיעה עם utm_source=resparts, utm_medium=comparison, utm_campaign=tradein-apple או tradein-samsung, ו-utm_content עם הדגם, הנפח והמצב. בכל כתובת יש גם מזהה לחיצה חד-פעמי (click_id, אלא אם סיכמנו שם פרמטר אחר). המזהה לא מכיל פרטים אישיים. לפי המזהה אפשר לקשר את הביקור ללחיצה אצלנו. כדי לזכות אותנו על עסקה צריך הסכמה נפרדת, ומזהה שותף או דיווח חזרה שלכם עם אותו מזהה לחיצה.

English:

> We send visitors from a trade-in comparison page. Each click arrives with utm_source=resparts, utm_medium=comparison, utm_campaign=tradein-apple or tradein-samsung, and utm_content set to the model, storage and condition. Every URL also has a one-time click id (click_id, unless we agreed a different parameter name). The id contains no personal data. You can match that id to a click on our side. Crediting us for a completed trade-in takes a separate agreement, and either an affiliate id or a report back from you that includes the same click id.

## What we store

`catalog.outbound_clicks` is private. RLS is on, there are no policies, and the API roles have no table grant. The secret key cannot select the table; it can only call `record_click`, which copies the current price from the offer.

Columns: `click_id`, `offer_ref`, company, model, storage, condition, price at click time, locale (`he` or `en`), `user_id` (always null until accounts exist), an HMAC of the IP and user agent (daily-rotating salt, never the raw IP), the path of the page on our site that sent the click, the attribution parameters, and the time.

Rows older than 13 months are removed by:

```sql
select catalog.purge_outbound_clicks();
```

Run that monthly in the SQL editor until a scheduler is attached. It is not granted to the API.

To see recent clicks:

```sql
select created_at, company_slug, model_slug, storage_gb, grade, price, locale, url_params
from catalog.outbound_clicks
order by created_at desc
limit 50;
```

## Adding a company

No code change. Insert one row (the host of `destination_url` must be in `allowed_hosts`):

```sql
insert into catalog.partner_tracking (
  company_id, destination_url, allowed_hosts, tracking_mode, click_id_param, static_params, utm_source_override
) values (
  (select id from public.companies where slug = 'partner'),
  'https://www.partner.co.il/trade-in',
  array['www.partner.co.il', 'partner.co.il'],
  'utm_only',
  null,
  '{}',
  null
);
```

Set `click_id_param` to the name that company asked for (`subid`, `clickref`, `aff_sub`, …) and put their affiliate id in `static_params` when you have one. Set `tracking_mode` to `affiliate_params` when `static_params` should be sent.

## Keys

Create these when you apply migration 006. Server-only. Never `NEXT_PUBLIC_`. Never commit them.

| Name | Value |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase secret key, `sb_secret_…`. Only `frontend/lib/server/clicks.ts` reads it. |
| `TRACKING_UTM_SOURCE` | `resparts` |
| `TRACKING_HASH_SECRET` | At least 32 random characters. Used only to hash the IP. |

Until the secret key and migration 006 are in place, **Go to offer** shows an unavailable page and does not guess a company URL.

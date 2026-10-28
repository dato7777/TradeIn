# Supabase setup checklist

Steps that cannot be done from code. Do them in order and tick each box.
Per decision D6, migrations go straight to production, **one at a time**, each followed by its check.

## Phase 2 — read model (do now)

### 0. Before anything

- [ ] **Turn off public sign-ups for now.** Authentication → Sign In / Providers → Email → turn off **Allow new users to sign up**. Your existing admin login keeps working. (Decision D2: sign-ups stay off until Phase 5.)
- [ ] **Backup.** In a terminal on your Mac, using the same connection string as `DATABASE_URL` on Render (Supabase → Connect → Session pooler; it contains the DB password, so type it only in your terminal):

  ```bash
  /opt/homebrew/opt/libpq/bin/pg_dump "postgresql://postgres.<ref>:<password>@<host>:5432/postgres" \
    --schema=public --no-owner --format=custom --file ~/tradein-backup-2026-10-28.dump
  ```

  Keep the file **outside** the repo. Check it is not empty: `ls -lh ~/tradein-backup-2026-10-28.dump`.
- [ ] **Run a fresh scrape** for KSP, Pelephone and Dynamica in `/datadmin/scrape`. Current prices are from 2026-10-21 and pass the 168h hide window today, so without a new scrape the public read model is empty.

### 1. Migration 002 — lock down admin tables

- [ ] SQL Editor → New query → paste all of `supabase/migrations/002_lock_down_admin_tables.sql` → Run.
- [ ] Check (should list **only** `service_role` rows):

  ```sql
  select table_name, grantee, string_agg(privilege_type, ', ') as privileges
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
  group by 1, 2 order by 1, 2;
  ```
- [ ] **Check the admin right away:** log in at `/datadmin/login`, open the summary, open one company page, run one scrape (KSP).
- [ ] If anything in the admin fails: run `supabase/rollbacks/002_lock_down_admin_tables.down.sql` and tell me what failed.

### 2. Migration 003 — catalog tables

- [ ] Paste and run `supabase/migrations/003_catalog_schema.sql`.
- [ ] Check (expect 4 rows; KSP, Pelephone and Dynamica with a destination):

  ```sql
  select c.slug, p.is_active, t.destination_url
  from public.companies c
  join catalog.company_public_profiles p on p.company_id = c.id
  left join catalog.partner_tracking t on t.company_id = c.id
  order by c.slug;
  ```

### 3. Migration 004 — public read model

- [ ] Paste and run `supabase/migrations/004_public_read_model.sql`.
- [ ] Check (expect one row per brand, with model counts):

  ```sql
  select * from public_site.list_brands();
  select company_slug, price, is_stale
  from public_site.offers_for('iphone-15-pro-max', 256, 'A');
  ```

### 4. Expose the read model to the API

- [ ] Project Settings → Data API → **Exposed schemas**: add `public_site`. Save. Leave `public` as is (its tables are now locked).
- [ ] Do **not** add `catalog` or `read_model`.

### 5. API keys

- [ ] Project Settings → API Keys: make sure a **publishable key** (`sb_publishable_…`) exists; create one if not. This is the only key the public site needs in Phase 2.
- [ ] Do not create or copy a secret key yet (Phase 4).

### 6. Verify from outside (replace `<ref>` and the key)

```bash
# Read model works with the publishable key (expect JSON rows)
curl -s -X POST "https://<ref>.supabase.co/rest/v1/rpc/list_brands" \
  -H "apikey: sb_publishable_..." -H "Content-Profile: public_site" \
  -H "Content-Type: application/json" -d '{}'

# Admin tables are closed (expect an error with code 42501, permission denied)
curl -s "https://<ref>.supabase.co/rest/v1/company_prices?select=id&limit=1" \
  -H "apikey: sb_publishable_..."
```

- [ ] First command returns brands; second returns `42501`.

### 7. Security Advisor

- [ ] Database → Advisors → Security Advisor → **Rerun**. There should be no errors or warnings for objects in `catalog`, `read_model` or `public_site`. Send me a screenshot of anything listed.

### 8. Public site environment (Vercel, new project for `web/`)

- [ ] `NEXT_PUBLIC_SITE_URL` (https), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nothing else yet, and nothing copied from the admin project.

---

## Managing public catalog data (SQL editor)

All public-site content lives in the private `catalog` schema. Scraped tables are never edited.

```sql
-- Freshness windows (hours): "may be outdated" after fresh, hidden after hide
update catalog.settings set price_fresh_hours = 72, price_hide_hours = 336, updated_at = now();

-- Payout and delivery details for a company
update catalog.company_public_profiles
set payout_methods = array['bank_transfer'], payout_time_he = 'עד 7 ימי עסקים',
    payout_time_en = 'Up to 7 business days', delivery_methods = array['mail', 'in_store'],
    updated_at = now()
where company_id = (select id from public.companies where slug = 'ksp');

-- Merge a name variant into one public model
insert into catalog.model_aliases (brand, source_model, model_slug)
values ('apple', '17 Air', 'iphone-air');

-- Hide one offer (all storages and grades when those are NULL)
insert into catalog.offer_publication_overrides (company_id, model_slug, storage_gb, grade, reason)
values ((select id from public.companies where slug = 'pelephone'), 'iphone-16', 128, 'C', 'wrong price');

-- Give Partner a destination so its offers can appear
insert into catalog.partner_tracking (company_id, destination_url, allowed_hosts)
values ((select id from public.companies where slug = 'partner'),
        'https://www.partner.co.il/...', array['www.partner.co.il']);
```

## Later phases

- **Phase 4:** create the secret key (`sb_secret_…`) for the click-logging module only.
- **Phase 5:** custom SMTP (SPF, DKIM, DMARC), he/en email templates, CAPTCHA (Turnstile), Auth rate limits, exact redirect URL allowlist, Google provider, re-enable sign-ups **after** the admin check is hardened (finding C3).

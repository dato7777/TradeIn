-- 003_catalog_schema
-- Private side tables for the public read model. Additive only: no existing table,
-- column or row is changed. The schema is NOT exposed by the API and the API roles
-- have no privileges on it; it is written only by `postgres` (SQL editor / admin).
-- Rollback: supabase/rollbacks/003_catalog_schema.down.sql

begin;

create schema if not exists catalog;
revoke all on schema catalog from public, anon, authenticated;

-- Single-row settings used by the read model.
create table catalog.settings (
  id boolean primary key default true check (id),
  price_fresh_hours integer not null default 48 check (price_fresh_hours > 0),
  price_hide_hours integer not null default 168 check (price_hide_hours > 0),
  updated_at timestamptz not null default now(),
  check (price_hide_hours >= price_fresh_hours)
);

-- Normalized condition scale A–D. tier = companies.grade_columns[].summary_tier.
create table catalog.condition_grades (
  grade text primary key check (grade in ('A', 'B', 'C', 'D')),
  tier smallint not null unique check (tier between 1 and 4),
  name_he text not null check (char_length(name_he) between 1 and 60),
  name_en text not null check (char_length(name_en) between 1 and 60),
  description_he text not null check (char_length(description_he) between 1 and 400),
  description_en text not null check (char_length(description_en) between 1 and 400)
);

-- Public profile per company. A company is shown only when is_active = true.
create table catalog.company_public_profiles (
  company_id uuid primary key references public.companies (id) on delete cascade,
  is_active boolean not null default false,
  display_name_he text check (char_length(display_name_he) between 1 and 80),
  display_name_en text check (char_length(display_name_en) between 1 and 80),
  logo_url text check (logo_url ~ '^(https://|/)[^\s]*$'),
  website_url text check (website_url ~ '^https://[^\s]+$'),
  payout_methods text[] not null default '{}'
    check (payout_methods <@ array['bank_transfer', 'store_credit', 'gift_card', 'bill_credit', 'cash']::text[]),
  payout_time_he text check (char_length(payout_time_he) <= 120),
  payout_time_en text check (char_length(payout_time_en) <= 120),
  delivery_methods text[] not null default '{}'
    check (delivery_methods <@ array['mail', 'courier', 'drop_off', 'in_store']::text[]),
  prices_include_vat boolean,
  updated_at timestamptz not null default now()
);

-- Company-specific condition policy per normalized grade.
create table catalog.company_condition_policies (
  company_id uuid not null references public.companies (id) on delete cascade,
  grade text not null references catalog.condition_grades (grade),
  summary_he text check (char_length(summary_he) <= 1000),
  summary_en text check (char_length(summary_en) <= 1000),
  policy_url text check (policy_url ~ '^https://[^\s]+$'),
  updated_at timestamptz not null default now(),
  primary key (company_id, grade)
);

-- Outbound destination + attribution config per company (used fully in Phase 4).
-- An offer is published only if destination_url is https and its host is allowlisted.
create table catalog.partner_tracking (
  company_id uuid primary key references public.companies (id) on delete cascade,
  destination_url text not null check (destination_url ~ '^https://[^\s]+$'),
  allowed_hosts text[] not null check (cardinality(allowed_hosts) between 1 and 10),
  tracking_mode text not null default 'utm_only'
    check (tracking_mode in ('utm_only', 'affiliate_params', 's2s')),
  click_id_param text check (click_id_param ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'),
  static_params jsonb not null default '{}'::jsonb check (jsonb_typeof(static_params) = 'object'),
  utm_source_override text check (utm_source_override ~ '^[a-z0-9_-]{2,40}$'),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Merge model name variants (e.g. "17 Air" and "Air") into one public model.
create table catalog.model_aliases (
  brand text not null check (brand in ('apple', 'samsung')),
  source_model text not null,
  model_slug text not null check (model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(model_slug) <= 80),
  primary key (brand, source_model)
);

-- Optional curated data per public model.
create table catalog.model_overrides (
  model_slug text primary key check (model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(model_slug) <= 80),
  display_name_he text check (char_length(display_name_he) between 1 and 80),
  display_name_en text check (char_length(display_name_en) between 1 and 80),
  release_year smallint check (release_year between 2007 and 2100),
  image_url text check (image_url ~ '^(https://|/)[^\s]*$'),
  is_hidden boolean not null default false,
  popularity smallint not null default 0 check (popularity between 0 and 1000),
  updated_at timestamptz not null default now()
);

-- Hide specific offers without touching scraped data. NULL storage/grade = all.
create table catalog.offer_publication_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  model_slug text not null check (model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  storage_gb integer check (storage_gb between 1 and 16384),
  grade text references catalog.condition_grades (grade),
  is_hidden boolean not null default true,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique nulls not distinct (company_id, model_slug, storage_gb, grade)
);

-- Defense in depth: RLS on, no policies, no API-role privileges.
alter table catalog.settings enable row level security;
alter table catalog.condition_grades enable row level security;
alter table catalog.company_public_profiles enable row level security;
alter table catalog.company_condition_policies enable row level security;
alter table catalog.partner_tracking enable row level security;
alter table catalog.model_aliases enable row level security;
alter table catalog.model_overrides enable row level security;
alter table catalog.offer_publication_overrides enable row level security;

revoke all on all tables in schema catalog from public, anon, authenticated;
alter default privileges for role postgres in schema catalog
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema catalog
  revoke execute on functions from public, anon, authenticated;

-- Seed data (new tables only).
insert into catalog.settings default values on conflict do nothing;

-- TODO(content): generic plain-language grade texts, pending owner approval.
insert into catalog.condition_grades (grade, tier, name_he, name_en, description_he, description_en) values
  ('A', 1, 'כמו חדש', 'Like new',
   'בלי שריטות או סימני שימוש, הכול תקין.',
   'No scratches or signs of use. Everything works.'),
  ('B', 2, 'תקין', 'Good',
   'סימני שימוש קלים, בלי שבר או סדק. הכול תקין.',
   'Light signs of use, no cracks. Everything works.'),
  ('C', 3, 'שבור או סדוק', 'Cracked',
   'שבר או סדק במסך או בגב, או בלאי משמעותי. המכשיר נדלק ועובד.',
   'Cracked screen or back, or heavy wear. The phone turns on and works.'),
  ('D', 4, 'תקול', 'Faulty',
   'המכשיר לא עובד כראוי, לא נדלק או שיש בו תקלה משמעותית.',
   'Does not work properly, does not turn on, or has a major fault.')
on conflict (grade) do nothing;

-- TODO(content): payout and delivery details are unknown; left empty.
insert into catalog.company_public_profiles (company_id, is_active, display_name_he, display_name_en)
select c.id, true, v.name_he, v.name_en
from public.companies c
join (values
  ('ksp', 'KSP', 'KSP'),
  ('pelephone', 'פלאפון', 'Pelephone'),
  ('dynamica', 'דינמיקה', 'Dynamica'),
  ('partner', 'פרטנר', 'Partner')
) as v (slug, name_he, name_en) on v.slug = c.slug
on conflict (company_id) do nothing;

-- Destinations: KSP and Pelephone from companies.trade_in_url; Dynamica from
-- backend/config/companies.yaml. Partner has no known URL, so it has no offers yet.
insert into catalog.partner_tracking (company_id, destination_url, allowed_hosts)
select c.id, v.url, v.hosts
from public.companies c
join (values
  ('ksp', 'https://ksp.co.il/kspTradeIn/', array['ksp.co.il', 'www.ksp.co.il']),
  ('pelephone', 'https://www.pelephone.co.il/ds/heb/eshop/trade-in/', array['www.pelephone.co.il', 'pelephone.co.il']),
  ('dynamica', 'https://www.dynamica.co.il/pages/47738-tradein', array['www.dynamica.co.il', 'dynamica.co.il'])
) as v (slug, url, hosts) on v.slug = c.slug
on conflict (company_id) do nothing;

commit;

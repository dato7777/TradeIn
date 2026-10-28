-- pgTAP: data-quality rules of the public read model. Fixture rows live only
-- inside this transaction and are rolled back. Never run against production.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(26);

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, slug, name, source_type, grade_columns) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst-alpha', 'Alpha', 'scraper',
   '[{"key":"a","label":"Mint","summary_tier":1},{"key":"b","label":"Used","summary_tier":2},{"key":"x","label":"Broken","summary_tier":4}]'),
  ('00000000-0000-0000-0000-0000000000b2', 'tst-beta', 'Beta', 'upload',
   '[{"key":"a","label":"OK","summary_tier":1}]'),
  ('00000000-0000-0000-0000-0000000000c3', 'tst-inactive', 'Inactive', 'scraper',
   '[{"key":"a","label":"OK","summary_tier":1}]'),
  ('00000000-0000-0000-0000-0000000000d4', 'tst-badhost', 'BadHost', 'scraper',
   '[{"key":"a","label":"OK","summary_tier":1}]');

insert into catalog.company_public_profiles (company_id, is_active, display_name_he, display_name_en) values
  ('00000000-0000-0000-0000-0000000000a1', true, 'אלפא', 'Alpha'),
  ('00000000-0000-0000-0000-0000000000b2', true, null, null),
  ('00000000-0000-0000-0000-0000000000c3', false, null, null),
  ('00000000-0000-0000-0000-0000000000d4', true, null, null);

insert into catalog.partner_tracking (company_id, destination_url, allowed_hosts) values
  ('00000000-0000-0000-0000-0000000000a1', 'https://alpha.example/trade', array['alpha.example']),
  ('00000000-0000-0000-0000-0000000000b2', 'https://beta.example/', array['beta.example']),
  ('00000000-0000-0000-0000-0000000000c3', 'https://inactive.example/', array['inactive.example']),
  ('00000000-0000-0000-0000-0000000000d4', 'https://evil.example/', array['good.example']);

insert into catalog.model_aliases (brand, source_model, model_slug) values
  ('apple', 'Air', 'iphone-17-air');

insert into public.company_prices (company_id, raw_device_name, normalized_name, brand, model, storage_gb, grade, price, scraped_at, uploaded_at) values
  -- Alpha: fresh offers
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 2500, now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'b', 2100, now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 1TB',   'apple', '15 Pro', '1TB',   'a', 3300, now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 512GB', 'apple', '15 Pro', '512GB', 'a', 0,    now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'x', 400,  now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone Air 256GB',    'apple', 'Air',    '256GB', 'a', 1900, now() - interval '1 hour', null),
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'Samsung Galaxy S10+ 128GB', 'samsung', 'S10+', '128GB', 'a', 300, now() - interval '1 hour', null),
  -- Beta: higher price but stale (still visible), and one hidden (too old)
  ('00000000-0000-0000-0000-0000000000b2', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 2700, null, now() - interval '100 hours'),
  ('00000000-0000-0000-0000-0000000000b2', 'r', 'iPhone 14 128GB',     'apple', '14',     '128GB', 'a', 1200, null, now() - interval '200 hours'),
  -- Inactive company and disallowed host: never visible
  ('00000000-0000-0000-0000-0000000000c3', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 9999, now(), null),
  ('00000000-0000-0000-0000-0000000000d4', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 8888, now(), null);

-- Helpers -------------------------------------------------------------------
select is(catalog.model_slug('apple', '15 Pro Max'), 'iphone-15-pro-max', 'apple slug');
select is(catalog.model_slug('samsung', 'Z Fold 5'), 'galaxy-z-fold-5', 'samsung slug');
select is(catalog.model_slug('samsung', 'S10+'), 'galaxy-s10-plus', 'plus sign does not collide with base model');
select is(catalog.storage_to_gb('1TB'), 1024, 'TB to GB');
select is(catalog.storage_to_gb('256GB'), 256, 'GB');
select is(catalog.storage_to_gb('weird'), null::integer, 'unknown storage is null');
select is(catalog.url_host('https://user@evil.example/'), null::text, 'userinfo URLs are rejected');
select is(catalog.url_host('http://alpha.example/'), null::text, 'non-https URLs are rejected');

-- As the public API role ------------------------------------------------------
set local role anon;

select results_eq(
  $$select company_slug, price from public_site.offers_for('iphone-15-pro', 256, 'A')$$,
  $$values ('tst-beta'::text, 2700), ('tst-alpha'::text, 2500)$$,
  'offers sorted by price desc; inactive company and disallowed host excluded');

select is(
  (select is_stale from public_site.offers_for('iphone-15-pro', 256, 'A') where company_slug = 'tst-beta'),
  true, 'offer older than fresh window is flagged stale');
select is(
  (select is_stale from public_site.offers_for('iphone-15-pro', 256, 'A') where company_slug = 'tst-alpha'),
  false, 'fresh offer is not stale');
select is_empty(
  $$select 1 from public_site.offers_for('iphone-15-pro', 512, 'A')$$, 'zero price is excluded');
select is_empty(
  $$select 1 from public_site.offers_for('iphone-14', 128, 'A')$$, 'offer older than hide window is hidden');
select results_eq(
  $$select company_slug, company_grade_label from public_site.offers_for('iphone-15-pro', 256, 'D')$$,
  $$values ('tst-alpha'::text, 'Broken'::text)$$,
  'grade comes from summary_tier, not the company grade key');
select is(
  (select company_name_he from public_site.offers_for('iphone-15-pro', 256, 'A') where company_slug = 'tst-beta'),
  'Beta', 'company name falls back to companies.name');
select is_empty(
  $$select 1 from public_site.offers_for('iphone-15-pro''; drop table x; --', 256, 'A')$$,
  'malformed slug returns nothing');
select is_empty(
  $$select 1 from public_site.offers_for('iphone-15-pro', 256, 'Z')$$, 'invalid grade returns nothing');

select is(
  (select storage_options from public_site.get_model('iphone-15-pro')),
  array[256, 1024], 'storage options exclude zero-priced storages');
select is(
  (select display_name_en from public_site.get_model('iphone-17-air')),
  'iPhone Air', 'alias maps a variant to the curated slug');
select ok(
  exists (select 1 from public_site.search_models('אייפון 15') where model_slug = 'iphone-15-pro'),
  'Hebrew search finds iPhone models');
select is(
  (select display_name_he from public_site.get_model('iphone-15-pro')),
  'אייפון 15 פרו', 'Hebrew display name');
select ok(
  exists (select 1 from public_site.search_models('15 פרו') where model_slug = 'iphone-15-pro'),
  'Hebrew Pro finds the model');
select is_empty(
  $$select 1 from public_site.search_models('15_pro')$$,
  'LIKE wildcards in search are treated literally');
select is_empty($$select 1 from public_site.search_models('a')$$, 'search requires 2+ characters');
select throws_ok($$select * from public_site.list_models('nokia')$$, '22023', null, 'unknown brand is rejected');

reset role;

-- offer_ref stability across a delete-and-reinsert scrape.
create temporary table ref_before on commit drop as
  select offer_ref from public_site.offers_for('iphone-15-pro', 256, 'A') where company_slug = 'tst-alpha';
delete from public.company_prices where company_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.company_prices (company_id, raw_device_name, normalized_name, brand, model, storage_gb, grade, price, scraped_at)
values ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 2550, now());
select is(
  (select offer_ref from public_site.offers_for('iphone-15-pro', 256, 'A') where company_slug = 'tst-alpha'),
  (select offer_ref from ref_before),
  'offer_ref is stable when a scrape replaces rows');

select * from finish();
rollback;

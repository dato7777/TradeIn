-- pgTAP: click resolution and the private click log. Fixture rows live only
-- inside this transaction and are rolled back. Never run against production.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(28);

insert into public.companies (id, slug, name, source_type, grade_columns) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst-alpha', 'Alpha', 'scraper',
   '[{"key":"a","label":"Mint","summary_tier":1}]'),
  ('00000000-0000-0000-0000-0000000000d4', 'tst-badhost', 'BadHost', 'scraper',
   '[{"key":"a","label":"OK","summary_tier":1}]');

insert into catalog.company_public_profiles (company_id, is_active, display_name_he, display_name_en) values
  ('00000000-0000-0000-0000-0000000000a1', true, 'אלפא', 'Alpha'),
  ('00000000-0000-0000-0000-0000000000d4', true, null, null);

insert into catalog.partner_tracking (
  company_id, destination_url, allowed_hosts, tracking_mode, click_id_param, static_params, utm_source_override
) values
  ('00000000-0000-0000-0000-0000000000a1', 'https://alpha.example/trade?keep=1', array['alpha.example'],
   'affiliate_params', 'subid', '{"aff_id":"abc"}'::jsonb, 'resparts'),
  ('00000000-0000-0000-0000-0000000000d4', 'https://evil.example/', array['good.example'],
   'utm_only', null, '{}'::jsonb, null);

insert into public.company_prices (company_id, raw_device_name, normalized_name, brand, model, storage_gb, grade, price, scraped_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 2500, now()),
  ('00000000-0000-0000-0000-0000000000d4', 'r', 'iPhone 15 Pro 256GB', 'apple', '15 Pro', '256GB', 'a', 8888, now());

create temporary table good_ref (offer_ref text);
insert into good_ref select catalog.offer_ref('tst-alpha', 'iphone-15-pro', 256, 'A');
grant select on good_ref to service_role;

create temporary table bad_ref (offer_ref text);
insert into bad_ref select catalog.offer_ref('tst-badhost', 'iphone-15-pro', 256, 'A');
grant select on bad_ref to service_role;

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'catalog' and c.relname = 'outbound_clicks'),
  'RLS enabled on outbound_clicks');
select ok(
  not (select c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'catalog' and c.relname = 'outbound_clicks'),
  'RLS not forced on outbound_clicks');
select ok(
  not has_function_privilege('anon', 'public_site.resolve_offer(text)', 'execute'),
  'anon cannot execute resolve_offer');
select ok(
  not has_function_privilege('authenticated', 'public_site.resolve_offer(text)', 'execute'),
  'authenticated cannot execute resolve_offer');
select ok(
  not has_function_privilege('anon', 'public_site.record_click(uuid,text,text,text,text,jsonb)', 'execute'),
  'anon cannot execute record_click');
select ok(
  has_function_privilege('service_role', 'public_site.resolve_offer(text)', 'execute'),
  'service role can execute resolve_offer');
select ok(
  has_function_privilege('service_role', 'public_site.record_click(uuid,text,text,text,text,jsonb)', 'execute'),
  'service role can execute record_click');
select ok(
  not has_function_privilege('service_role', 'catalog.purge_outbound_clicks()', 'execute'),
  'service role cannot purge the click log');

set local role anon;
select throws_ok('select 1 from catalog.outbound_clicks', '42501', null, 'anon cannot read the click log');
select throws_ok(
  $$select * from public_site.resolve_offer('0123456789abcdef01234567')$$,
  '42501', null, 'anon cannot resolve an offer');
reset role;

set local role service_role;
select throws_ok('select 1 from catalog.outbound_clicks', '42501', null, 'service role cannot read the click log directly');
select results_eq(
  $$select destination_url, price, tracking_mode, click_id_param
    from public_site.resolve_offer((select offer_ref from good_ref))$$,
  $$values ('https://alpha.example/trade?keep=1'::text, 2500, 'affiliate_params'::text, 'subid'::text)$$,
  'resolve returns the stored destination, price and tracking config');
select is_empty(
  $$select 1 from public_site.resolve_offer((select offer_ref from bad_ref))$$,
  'a destination whose host is not allowlisted does not resolve');
select is_empty(
  $$select 1 from public_site.resolve_offer('0123456789abcdef01234567')$$,
  'an unknown offer ref resolves to nothing');
select is_empty(
  $$select 1 from public_site.resolve_offer('not-a-ref')$$,
  'a malformed offer ref resolves to nothing');
select lives_ok(
  $$select public_site.record_click(
      '018f3e6a-7b2c-7d4e-8f01-23456789abcd'::uuid,
      (select offer_ref from good_ref),
      'he',
      repeat('ab', 32),
      '/sell/apple/iphone-15-pro',
      '{"utm_source":"resparts","utm_medium":"comparison","utm_campaign":"tradein-apple","utm_content":"iphone-15-pro_256_A","subid":"018f3e6a-7b2c-7d4e-8f01-23456789abcd"}'::jsonb
    )$$,
  'service role can record a click');
select throws_ok(
  $$select public_site.record_click(
      '018f3e6a-7b2c-7d4e-8f01-23456789abcd'::uuid,
      (select offer_ref from good_ref),
      'he', null, '/', '{"utm_source":"resparts"}'::jsonb)$$,
  '23505', null, 'a click id cannot be recorded twice');
select throws_ok(
  $$select public_site.record_click(
      '018f3e6a-7b2c-7d4e-8f01-23456789abce'::uuid,
      (select offer_ref from good_ref),
      'he', null, '/', '{"utm_source":"a@b.com"}'::jsonb)$$,
  '22023', null, 'a parameter that looks like an email is rejected');
select throws_ok(
  $$select public_site.record_click(
      '018f3e6a-7b2c-7d4e-8f01-23456789abcf'::uuid,
      '0123456789abcdef01234567',
      'he', null, '/', '{"utm_source":"resparts"}'::jsonb)$$,
  '22023', null, 'an unknown offer is not logged');
select throws_ok(
  $$select public_site.record_click(
      '018f3e6a-7b2c-7d4e-8f01-23456789abd0'::uuid,
      (select offer_ref from good_ref),
      'he', null, '/../secret', '{"utm_source":"resparts"}'::jsonb)$$,
  '22023', null, 'a referrer path with traversal is rejected');
reset role;

select is(
  (select price from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'),
  2500, 'the logged price is the database price');
select is(
  (select company_slug from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'),
  'tst-alpha', 'the logged company comes from the offer');
select is(
  (select user_id from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'),
  null::uuid, 'no user id is stored');
select is(
  (select ip_ua_hash from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'),
  repeat('ab', 32), 'the log stores a hash, not a raw address');
select is(
  (select url_params ->> 'utm_source' from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'),
  'resparts', 'the logged parameters are the ones sent');

insert into catalog.outbound_clicks (
  click_id, offer_ref, company_slug, model_slug, storage_gb, grade, price, locale, url_params, created_at
) values (
  '018f3e6a-7b2c-7d4e-8f01-23456789abd1',
  (select offer_ref from good_ref),
  'tst-alpha', 'iphone-15-pro', 256, 'A', 2500, 'he', '{}'::jsonb, now() - interval '14 months'
);
select is(catalog.purge_outbound_clicks(), 1, 'purge deletes clicks older than 13 months');
select is_empty(
  $$select 1 from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abd1'$$,
  'the old click is gone');
select ok(
  exists (
    select 1 from catalog.outbound_clicks where click_id = '018f3e6a-7b2c-7d4e-8f01-23456789abcd'
  ),
  'a fresh click is kept');

select * from finish();
rollback;

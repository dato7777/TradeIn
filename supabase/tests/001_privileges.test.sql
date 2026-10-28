-- pgTAP: API roles have zero access to admin and catalog tables, and only the
-- public read model is callable. Run with `supabase test db` (local only).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(37);

-- Admin tables: RLS on, not forced, no API-role privileges.
select ok(c.relrowsecurity, format('RLS enabled on public.%s', c.relname))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'company_prices', 'profiles', 'scrape_jobs', 'upload_history')
order by c.relname;

select ok(not c.relforcerowsecurity, format('RLS not forced on public.%s', c.relname))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'company_prices', 'profiles', 'scrape_jobs', 'upload_history')
order by c.relname;

select table_privs_are('public', t, r, array[]::text[], format('%s has no privileges on public.%s', r, t))
from unnest(array['companies', 'company_prices', 'profiles', 'scrape_jobs', 'upload_history']) as t
cross join unnest(array['anon', 'authenticated']) as r
order by t, r;

-- Catalog: no schema usage for API roles.
select schema_privs_are('catalog', 'anon', array[]::text[], 'anon has no usage on catalog');
select schema_privs_are('catalog', 'authenticated', array[]::text[], 'authenticated has no usage on catalog');

-- Behavior, not just metadata.
set local role anon;
select throws_ok('select 1 from public.company_prices limit 1', '42501', null, 'anon cannot select company_prices');
select throws_ok($$insert into public.companies (slug, name, source_type, grade_columns) values ('x', 'x', 'upload', '[]')$$,
  '42501', null, 'anon cannot insert companies');
select throws_ok('delete from public.company_prices', '42501', null, 'anon cannot delete company_prices');
select throws_ok('truncate public.scrape_jobs', '42501', null, 'anon cannot truncate scrape_jobs');
select throws_ok('select 1 from catalog.partner_tracking', '42501', null, 'anon cannot read catalog.partner_tracking');
select throws_ok('select * from catalog.visible_offers()', '42501', null, 'anon cannot call catalog helpers');
select lives_ok('select * from public_site.list_condition_grades()', 'anon can call the public read model');
reset role;

set local role authenticated;
select throws_ok('select 1 from public.profiles limit 1', '42501', null, 'authenticated cannot select profiles');
select throws_ok('update public.companies set name = name', '42501', null, 'authenticated cannot update companies');
select throws_ok('select 1 from catalog.company_public_profiles', '42501', null, 'authenticated cannot read catalog');
reset role;

-- Function hygiene.
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'read_model' and not p.prosecdef),
  0, 'every read_model function is SECURITY DEFINER');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public_site' and p.prosecdef),
  0, 'no public_site function is SECURITY DEFINER');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('catalog', 'read_model', 'public_site')
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0, 'every new function pins search_path to empty');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('read_model', 'public_site')
     and has_function_privilege('public', p.oid, 'EXECUTE')),
  0, 'PUBLIC cannot execute read model functions');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'catalog' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'anon cannot execute catalog helpers');

select * from finish();
rollback;

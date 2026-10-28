-- 002_lock_down_admin_tables
-- Removes all API-role privileges from the existing admin tables.
--
-- Verified on production (2026-10-28) before writing this migration:
--   * RLS is already enabled (not forced) on all five tables, with no policies.
--   * Owner is `postgres`, which has BYPASSRLS; the FastAPI admin and the scrapers
--     connect as `postgres`, so they are unaffected by this migration.
--   * anon and authenticated still held every table privilege (incl. TRUNCATE).
--
-- Does NOT: change RLS settings, use FORCE ROW LEVEL SECURITY, touch data or columns.
-- Rollback: supabase/rollbacks/002_lock_down_admin_tables.down.sql

begin;

-- Keep RLS on (no-op where it is already enabled; never forced).
alter table public.companies enable row level security;
alter table public.company_prices enable row level security;
alter table public.profiles enable row level security;
alter table public.scrape_jobs enable row level security;
alter table public.upload_history enable row level security;

revoke all on table
  public.companies,
  public.company_prices,
  public.profiles,
  public.scrape_jobs,
  public.upload_history
from anon, authenticated, public;

-- Future tables, sequences and functions created by postgres in `public`
-- are no longer reachable by the API roles unless granted explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

commit;

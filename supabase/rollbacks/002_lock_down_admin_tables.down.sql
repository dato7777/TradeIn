-- Rollback for 002_lock_down_admin_tables.
-- Restores the privileges that existed before (verified 2026-10-28).
-- Only run this if the admin or scrapers break right after applying 002.

begin;

grant select, insert, update, delete, truncate, references, trigger on table
  public.companies,
  public.company_prices,
  public.profiles,
  public.scrape_jobs,
  public.upload_history
to anon, authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, public;

commit;

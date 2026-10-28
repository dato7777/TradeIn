-- Rollback for 003_catalog_schema.
-- Removes only the objects created by 003 (the catalog schema did not exist before).
-- Requires 004 to be rolled back first.

begin;

drop schema if exists catalog cascade;

commit;

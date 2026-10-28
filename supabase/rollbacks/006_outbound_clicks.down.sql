-- Rollback for 006_outbound_clicks.
-- Drops only the click log and the functions 006 added.

begin;

drop function if exists public_site.record_click(uuid, text, text, text, text, jsonb);
drop function if exists public_site.resolve_offer(text);
drop function if exists read_model.record_click(uuid, text, text, text, text, jsonb);
drop function if exists read_model.resolve_offer(text);
drop function if exists catalog.purge_outbound_clicks();
drop table if exists catalog.outbound_clicks;

commit;

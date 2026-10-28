-- Rollback for 004_public_read_model.
-- Removes only the objects created by 004. Remove `public_site` from
-- Settings -> API -> Exposed schemas first.

begin;

drop schema if exists public_site cascade;
drop schema if exists read_model cascade;

drop function if exists catalog.visible_models();
drop function if exists catalog.visible_offers();
drop function if exists catalog.offer_ref(text, text, integer, text);
drop function if exists catalog.url_host(text);
drop function if exists catalog.storage_to_gb(text);
drop function if exists catalog.model_display_name(text, text);
drop function if exists catalog.model_slug(text, text);

commit;

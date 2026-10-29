-- Rollback for 007_price_alerts.
-- Drops only the price-alert tables and the functions 007 added.

begin;

drop function if exists public_site.suppress_price_alert_email(text, text);
drop function if exists public_site.cleanup_price_alerts();
drop function if exists public_site.fail_price_alert(uuid, uuid, integer, text, integer, integer);
drop function if exists public_site.finish_price_alert(uuid, uuid, text, integer, integer, text, integer);
drop function if exists public_site.claim_price_alert(uuid, uuid, integer);
drop function if exists public_site.mark_price_alerts_evaluated(uuid[]);
drop function if exists public_site.list_due_price_alerts(integer);
drop function if exists public_site.delete_price_alerts_for_same_email(uuid);
drop function if exists public_site.delete_price_alert(uuid);
drop function if exists public_site.confirm_price_alert(uuid, integer, integer);
drop function if exists public_site.get_price_alert(uuid);
drop function if exists public_site.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer);

drop function if exists read_model.suppress_price_alert_email(text, text);
drop function if exists read_model.cleanup_price_alerts();
drop function if exists read_model.fail_price_alert(uuid, uuid, integer, text, integer, integer);
drop function if exists read_model.claim_price_alert(uuid, uuid, integer);
drop function if exists read_model.finish_price_alert(uuid, uuid, text, integer, integer, text, integer);
drop function if exists read_model.mark_price_alerts_evaluated(uuid[]);
drop function if exists read_model.list_due_price_alerts(integer);
drop function if exists read_model.delete_price_alerts_for_same_email(uuid);
drop function if exists read_model.delete_price_alert(uuid);
drop function if exists read_model.confirm_price_alert(uuid, integer, integer);
drop function if exists read_model.get_price_alert(uuid);
drop function if exists read_model.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer);

drop table if exists catalog.price_alert_sends;
drop table if exists catalog.email_suppressions;
drop table if exists catalog.price_alert_subscriptions;

commit;

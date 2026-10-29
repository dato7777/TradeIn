-- pgTAP: price alerts stay private, and the request rules hold.
-- One session cannot run two transactions at once, so the cap and the
-- unique key are checked by repeated calls. The advisory lock is what
-- serializes those calls when two requests arrive together.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(39);

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'catalog' and c.relname = 'price_alert_subscriptions'),
  'RLS enabled on price_alert_subscriptions');
select ok(
  not (select c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'catalog' and c.relname = 'price_alert_subscriptions'),
  'RLS not forced on price_alert_subscriptions');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'catalog' and c.relname = 'price_alert_sends'),
  'RLS enabled on price_alert_sends');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'catalog' and c.relname = 'email_suppressions'),
  'RLS enabled on email_suppressions');

select ok(
  not has_function_privilege('anon', 'public_site.request_price_alert(text,text,text,integer,text,text,text,text,integer,integer)', 'execute'),
  'anon cannot execute request_price_alert');
select ok(
  not has_function_privilege('authenticated', 'public_site.request_price_alert(text,text,text,integer,text,text,text,text,integer,integer)', 'execute'),
  'authenticated cannot execute request_price_alert');
select ok(
  has_function_privilege('service_role', 'public_site.request_price_alert(text,text,text,integer,text,text,text,text,integer,integer)', 'execute'),
  'service role can execute request_price_alert');
select ok(
  position('email' in pg_get_function_result('public_site.get_price_alert(uuid)'::regprocedure)) = 0,
  'the page lookup does not return the email');

set local role anon;
select throws_ok('select 1 from catalog.price_alert_subscriptions', '42501', null, 'anon cannot read subscriptions');
select throws_ok(
  $$insert into catalog.price_alert_subscriptions (email, email_hash, model_slug, storage_gb, condition, locale, status, consent_text_version)
    values ('a@b.co', repeat('ab', 32), 'iphone-15-pro', 128, 'A', 'he', 'pending', 'v1')$$,
  '42501', null, 'anon cannot insert a subscription');
reset role;

set local role authenticated;
select throws_ok('update catalog.price_alert_subscriptions set status = status', '42501', null, 'authenticated cannot update subscriptions');
select throws_ok('delete from catalog.price_alert_sends', '42501', null, 'authenticated cannot delete send logs');
reset role;

set local role service_role;
select throws_ok('select 1 from catalog.price_alert_subscriptions', '42501', null, 'service role cannot read subscriptions directly');
select throws_ok(
  $$select outcome from public_site.request_price_alert('bad', repeat('a1', 32), 'iphone-15-pro', 256, 'Z', 'he', 'v1', null, 5, 48)$$,
  '22023', null, 'a bad condition is rejected');
select throws_ok(
  $$select outcome from public_site.request_price_alert('one@example.com', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'fr', 'v1', null, 5, 48)$$,
  '22023', null, 'a bad locale is rejected');
select throws_ok(
  $$select outcome from public_site.request_price_alert(E'one@example.com\n', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48)$$,
  '22023', null, 'a newline in the email is rejected');
reset role;

select throws_ok(
  $$insert into catalog.price_alert_subscriptions (email, email_hash, model_slug, storage_gb, condition, locale, status, consent_text_version)
    values ('a@b.co', repeat('ee', 32), 'iphone-15-pro', 128, 'A', 'he', 'nope', 'v1')$$,
  '23514', null, 'status check rejects a bad value');

create temporary table first_alert (id uuid, outcome text);
grant all on first_alert to service_role;

set local role service_role;
insert into first_alert
select * from public_site.request_price_alert(
  'one@example.com', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48);
select is((select outcome from first_alert), 'created', 'a new address creates a pending alert');
select is(
  (select outcome from public_site.request_price_alert(
    'one@example.com', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48)),
  'cooldown', 'a second request inside 60 seconds does not refresh');
reset role;

update catalog.price_alert_subscriptions
set last_confirmation_sent_at = now() - interval '2 minutes'
where id = (select id from first_alert);

set local role service_role;
select is(
  (select outcome from public_site.request_price_alert(
    'one@example.com', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48)),
  'pending_refreshed', 'after the cooldown the same pending alert is refreshed');
select is(
  public_site.confirm_price_alert((select id from first_alert), 1780, 365),
  'confirmed', 'confirming stores the baseline and activates the alert');
select is(
  (select outcome from public_site.request_price_alert(
    'one@example.com', repeat('a1', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48)),
  'already_active', 'an active alert is not created again');
select is(
  (select status from public_site.get_price_alert((select id from first_alert))),
  'active', 'the page lookup returns the phone without the address');

select is(
  (select outcome from public_site.request_price_alert(
    'two@example.com', repeat('b2', 32), 'iphone-11', 128, 'A', 'en', 'v1', null, 2, 48)),
  'created', 'first phone under the cap is accepted');
select is(
  (select outcome from public_site.request_price_alert(
    'two@example.com', repeat('b2', 32), 'iphone-12', 128, 'B', 'en', 'v1', null, 2, 48)),
  'created', 'second phone under the cap is accepted');
select is(
  (select outcome from public_site.request_price_alert(
    'two@example.com', repeat('b2', 32), 'iphone-13', 128, 'C', 'en', 'v1', null, 2, 48)),
  'cap_reached', 'the per-email cap refuses another phone');
reset role;

insert into catalog.email_suppressions (email_hash, reason) values (repeat('c3', 32), 'complaint');

set local role service_role;
select is(
  (select outcome from public_site.request_price_alert(
    'three@example.com', repeat('c3', 32), 'iphone-15-pro', 256, 'A', 'he', 'v1', null, 5, 48)),
  'suppressed', 'a suppressed address is refused');
select ok(
  exists (
    select 1 from public_site.list_due_price_alerts(10)
    where id = (select id from first_alert)
  ),
  'the job lists the active alert');
select is(
  public_site.claim_price_alert((select id from first_alert), '018f3e6a-7b2c-7d4e-8f01-23456789abcd'::uuid, 24),
  true, 'the job can claim an active alert');
select is(
  public_site.claim_price_alert((select id from first_alert), '018f3e6a-7b2c-7d4e-8f01-23456789abce'::uuid, 24),
  false, 'a second claim does not take the same alert');
select lives_ok(
  $$select public_site.finish_price_alert(
      (select id from first_alert),
      '018f3e6a-7b2c-7d4e-8f01-23456789abcd'::uuid,
      'up', 1780, 1900, 'msg-1', 365)$$,
  'finishing a claim records the send');
reset role;

select is(
  (select baseline_price from catalog.price_alert_subscriptions where id = (select id from first_alert)),
  1900, 'a sent alert moves the baseline to the new price');

set local role service_role;
select is(
  (select outcome from public_site.request_price_alert(
    'four@example.com', repeat('d4', 32), 'iphone-14', 128, 'A', 'he', 'v1', null, 5, 48)),
  'created', 'a separate alert can be created for failure handling');
reset role;

create temporary table fail_alert (id uuid);
insert into fail_alert
select id from catalog.price_alert_subscriptions where email_hash = repeat('d4', 32);
grant select on fail_alert to service_role;

set local role service_role;
select is(
  public_site.confirm_price_alert((select id from fail_alert), null, 365),
  'confirmed', 'an alert with no current price can still be confirmed');
select is(
  public_site.claim_price_alert((select id from fail_alert), '018f3e6a-7b2c-7d4e-8f01-23456789abd0'::uuid, 24),
  true, 'the failure path can claim');
select lives_ok(
  $$select public_site.fail_price_alert(
      (select id from fail_alert),
      '018f3e6a-7b2c-7d4e-8f01-23456789abd0'::uuid,
      1, 'down', 1780, 1600)$$,
  'a failed send is recorded');
reset role;

select is(
  (select status from catalog.price_alert_subscriptions where id = (select id from fail_alert)),
  'paused', 'too many failures pause the alert');

update catalog.price_alert_subscriptions
set pending_expires_at = now() - interval '1 hour'
where email_hash = repeat('b2', 32);

select is(
  (select pending_deleted from public_site.cleanup_price_alerts()),
  2, 'cleanup deletes expired pending alerts');

select is(
  public_site.suppress_price_alert_email(repeat('c3', 32), 'complaint'),
  0, 'suppressing the same address again deletes nothing new');

select * from finish();
rollback;

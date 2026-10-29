-- 007_price_alerts
-- Private email price-alert tables. No tokens are stored.
-- The app calls public_site functions (SECURITY INVOKER). Those call
-- read_model functions (SECURITY DEFINER), which are the only writers.
-- anon, authenticated, and service_role cannot read the tables directly.
-- Not applied anywhere until the owner approves this file.
-- Rollback: supabase/rollbacks/007_price_alerts.down.sql

begin;

create table catalog.price_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) between 3 and 254
    and email = lower(btrim(email))
    and position('@' in email) > 1
    and email !~ '[[:space:][:cntrl:]]'
  ),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  model_slug text not null check (
    model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(model_slug) <= 80
  ),
  storage_gb integer not null check (storage_gb between 1 and 16384),
  condition char(1) not null check (condition in ('A', 'B', 'C', 'D')),
  locale text not null check (locale in ('he', 'en')),
  status text not null check (status in ('pending', 'active', 'paused')),
  pending_expires_at timestamptz,
  last_confirmation_sent_at timestamptz,
  consent_text_version text not null check (consent_text_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  signup_ip_hash text check (signup_ip_hash ~ '^[0-9a-f]{64}$'),
  confirmed_at timestamptz,
  expires_at timestamptz,
  baseline_price integer check (baseline_price > 0),
  baseline_at timestamptz,
  last_alert_at timestamptz,
  last_alert_price integer check (last_alert_price > 0),
  last_evaluated_at timestamptz,
  claim_id uuid,
  claimed_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_hash, model_slug, storage_gb, condition)
);

create index price_alert_subscriptions_job_idx
  on catalog.price_alert_subscriptions (status, last_evaluated_at);
create index price_alert_subscriptions_pending_expiry_idx
  on catalog.price_alert_subscriptions (pending_expires_at);
create index price_alert_subscriptions_active_expiry_idx
  on catalog.price_alert_subscriptions (expires_at);

create table catalog.price_alert_sends (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null,
  kind text not null check (kind in ('up', 'down', 'available')),
  old_price integer check (old_price > 0),
  new_price integer check (new_price > 0),
  provider_message_id text check (
    provider_message_id !~ '[[:cntrl:]]'
    and char_length(provider_message_id) <= 200
  ),
  status text not null check (status in ('sent', 'failed')),
  created_at timestamptz not null default now()
);

create index price_alert_sends_created_at_idx on catalog.price_alert_sends (created_at);

create table catalog.email_suppressions (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now()
);

alter table catalog.price_alert_subscriptions enable row level security;
alter table catalog.price_alert_sends enable row level security;
alter table catalog.email_suppressions enable row level security;

revoke all on table catalog.price_alert_subscriptions from public, anon, authenticated, service_role;
revoke all on table catalog.price_alert_sends from public, anon, authenticated, service_role;
revoke all on table catalog.email_suppressions from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- read_model writers. DEFINER so the secret key has no table grant.
-- ---------------------------------------------------------------------------

create function read_model.request_price_alert(
  p_email text,
  p_email_hash text,
  p_model_slug text,
  p_storage_gb integer,
  p_condition text,
  p_locale text,
  p_consent_text_version text,
  p_signup_ip_hash text,
  p_max_per_email integer,
  p_confirm_ttl_hours integer
)
returns table (id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_status text;
  v_last timestamptz;
  v_count integer;
begin
  if p_email is null
     or char_length(p_email) < 3
     or char_length(p_email) > 254
     or p_email <> lower(btrim(p_email))
     or position('@' in p_email) < 2
     or p_email ~ '[[:space:][:cntrl:]]'
     or p_email_hash is null
     or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_model_slug is null
     or p_model_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(p_model_slug) > 80
     or p_storage_gb is null
     or p_storage_gb not between 1 and 16384
     or p_condition is null
     or p_condition not in ('A', 'B', 'C', 'D')
     or p_locale is null
     or p_locale not in ('he', 'en')
     or p_consent_text_version is null
     or p_consent_text_version !~ '^[A-Za-z0-9._-]{1,40}$'
     or (p_signup_ip_hash is not null and p_signup_ip_hash !~ '^[0-9a-f]{64}$')
     or p_max_per_email is null
     or p_max_per_email not between 1 and 20
     or p_confirm_ttl_hours is null
     or p_confirm_ttl_hours not between 1 and 168
  then
    raise exception 'invalid price alert request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email_hash, 4815162342));

  if exists (
    select 1 from catalog.email_suppressions s where s.email_hash = p_email_hash
  ) then
    return query select null::uuid, 'suppressed'::text;
    return;
  end if;

  select sub.id, sub.status, sub.last_confirmation_sent_at
    into v_id, v_status, v_last
  from catalog.price_alert_subscriptions sub
  where sub.email_hash = p_email_hash
    and sub.model_slug = p_model_slug
    and sub.storage_gb = p_storage_gb
    and sub.condition = p_condition;

  if found then
    if v_status = 'active' then
      return query select v_id, 'already_active'::text;
      return;
    end if;
    if v_status = 'pending'
       and v_last is not null
       and v_last > pg_catalog.now() - interval '60 seconds' then
      return query select v_id, 'cooldown'::text;
      return;
    end if;
    if v_status = 'paused' then
      select count(*)::integer into v_count
      from catalog.price_alert_subscriptions sub
      where sub.email_hash = p_email_hash
        and sub.status in ('pending', 'active');
      if v_count >= p_max_per_email then
        return query select v_id, 'cap_reached'::text;
        return;
      end if;
    end if;

    update catalog.price_alert_subscriptions sub
    set email = p_email,
        status = 'pending',
        locale = p_locale,
        consent_text_version = p_consent_text_version,
        signup_ip_hash = p_signup_ip_hash,
        pending_expires_at = pg_catalog.now() + make_interval(hours => p_confirm_ttl_hours),
        last_confirmation_sent_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where sub.id = v_id;
    return query select v_id, 'pending_refreshed'::text;
    return;
  end if;

  select count(*)::integer into v_count
  from catalog.price_alert_subscriptions sub
  where sub.email_hash = p_email_hash
    and sub.status in ('pending', 'active');
  if v_count >= p_max_per_email then
    return query select null::uuid, 'cap_reached'::text;
    return;
  end if;

  insert into catalog.price_alert_subscriptions (
    email, email_hash, model_slug, storage_gb, condition, locale, status,
    pending_expires_at, last_confirmation_sent_at, consent_text_version, signup_ip_hash
  ) values (
    p_email, p_email_hash, p_model_slug, p_storage_gb, p_condition, p_locale, 'pending',
    pg_catalog.now() + make_interval(hours => p_confirm_ttl_hours),
    pg_catalog.now(), p_consent_text_version, p_signup_ip_hash
  )
  returning id into v_id;

  return query select v_id, 'created'::text;
end
$$;

create function read_model.get_price_alert(p_id uuid)
returns table (
  id uuid,
  model_slug text,
  storage_gb integer,
  condition text,
  locale text,
  status text,
  pending_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sub.id, sub.model_slug, sub.storage_gb, sub.condition::text, sub.locale, sub.status, sub.pending_expires_at
  from catalog.price_alert_subscriptions sub
  where p_id is not null
    and sub.id = p_id
$$;

create function read_model.confirm_price_alert(
  p_id uuid,
  p_baseline_price integer,
  p_retention_days integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_pending timestamptz;
begin
  if p_id is null
     or p_retention_days is null
     or p_retention_days not between 1 and 3650
     or (p_baseline_price is not null and p_baseline_price <= 0)
  then
    raise exception 'invalid price alert confirm' using errcode = '22023';
  end if;

  select sub.status, sub.pending_expires_at
    into v_status, v_pending
  from catalog.price_alert_subscriptions sub
  where sub.id = p_id;

  if not found then
    return 'missing';
  end if;
  if v_status = 'active' then
    return 'already_active';
  end if;
  if v_status <> 'pending' or v_pending is null or v_pending <= pg_catalog.now() then
    return 'expired';
  end if;

  update catalog.price_alert_subscriptions sub
  set status = 'active',
      confirmed_at = pg_catalog.now(),
      baseline_price = p_baseline_price,
      baseline_at = pg_catalog.now(),
      expires_at = pg_catalog.now() + make_interval(days => p_retention_days),
      pending_expires_at = null,
      updated_at = pg_catalog.now()
  where sub.id = p_id;

  return 'confirmed';
end
$$;

create function read_model.delete_price_alert(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_id is null then
    raise exception 'invalid price alert id' using errcode = '22023';
  end if;
  delete from catalog.price_alert_subscriptions sub where sub.id = p_id;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create function read_model.delete_price_alerts_for_same_email(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_count integer;
begin
  if p_id is null then
    raise exception 'invalid price alert id' using errcode = '22023';
  end if;
  select sub.email_hash into v_hash
  from catalog.price_alert_subscriptions sub
  where sub.id = p_id;
  if not found then
    return 0;
  end if;
  delete from catalog.price_alert_subscriptions sub where sub.email_hash = v_hash;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create function read_model.list_due_price_alerts(p_limit integer)
returns table (
  id uuid,
  email text,
  email_hash text,
  model_slug text,
  storage_gb integer,
  condition text,
  locale text,
  baseline_price integer,
  last_alert_at timestamptz,
  failure_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'invalid price alert batch' using errcode = '22023';
  end if;
  return query
    select sub.id, sub.email, sub.email_hash, sub.model_slug, sub.storage_gb,
           sub.condition::text, sub.locale, sub.baseline_price, sub.last_alert_at, sub.failure_count
    from catalog.price_alert_subscriptions sub
    where sub.status = 'active'
      and not exists (
        select 1 from catalog.email_suppressions s where s.email_hash = sub.email_hash
      )
    order by sub.last_evaluated_at asc nulls first, sub.id
    limit p_limit;
end
$$;

create function read_model.mark_price_alerts_evaluated(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_ids is null or cardinality(p_ids) > 500 then
    raise exception 'invalid price alert batch' using errcode = '22023';
  end if;
  update catalog.price_alert_subscriptions sub
  set last_evaluated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where sub.id = any (p_ids)
    and sub.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create function read_model.claim_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_cooldown_hours integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_claim_id is null
     or p_cooldown_hours is null
     or p_cooldown_hours not between 1 and 168
  then
    raise exception 'invalid price alert claim' using errcode = '22023';
  end if;

  update catalog.price_alert_subscriptions sub
  set claim_id = p_claim_id,
      claimed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where sub.id = p_id
    and sub.status = 'active'
    and (sub.claim_id is null or sub.claimed_at < pg_catalog.now() - interval '10 minutes')
    and (
      sub.last_alert_at is null
      or sub.last_alert_at <= pg_catalog.now() - make_interval(hours => p_cooldown_hours)
    );
  return found;
end
$$;

create function read_model.finish_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_kind text,
  p_old_price integer,
  p_new_price integer,
  p_provider_message_id text,
  p_retention_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_claim_id is null
     or p_kind is null or p_kind not in ('up', 'down', 'available')
     or p_new_price is null or p_new_price <= 0
     or (p_old_price is not null and p_old_price <= 0)
     or p_retention_days is null or p_retention_days not between 1 and 3650
     or (p_provider_message_id is not null and (
       p_provider_message_id ~ '[[:cntrl:]]' or char_length(p_provider_message_id) > 200
     ))
  then
    raise exception 'invalid price alert finish' using errcode = '22023';
  end if;

  update catalog.price_alert_subscriptions sub
  set baseline_price = p_new_price,
      baseline_at = pg_catalog.now(),
      last_alert_at = pg_catalog.now(),
      last_alert_price = p_new_price,
      expires_at = pg_catalog.now() + make_interval(days => p_retention_days),
      claim_id = null,
      claimed_at = null,
      failure_count = 0,
      updated_at = pg_catalog.now()
  where sub.id = p_id
    and sub.claim_id = p_claim_id
    and sub.status = 'active';
  if not found then
    raise exception 'price alert claim was lost' using errcode = '22023';
  end if;

  insert into catalog.price_alert_sends (
    subscription_id, kind, old_price, new_price, provider_message_id, status
  ) values (
    p_id, p_kind, p_old_price, p_new_price, p_provider_message_id, 'sent'
  );
end
$$;

create function read_model.fail_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_max_failures integer,
  p_kind text,
  p_old_price integer,
  p_new_price integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failures integer;
begin
  if p_id is null or p_claim_id is null
     or p_max_failures is null or p_max_failures not between 1 and 20
     or p_kind is null or p_kind not in ('up', 'down', 'available')
     or (p_old_price is not null and p_old_price <= 0)
     or (p_new_price is not null and p_new_price <= 0)
  then
    raise exception 'invalid price alert failure' using errcode = '22023';
  end if;

  update catalog.price_alert_subscriptions sub
  set failure_count = sub.failure_count + 1,
      status = case
        when sub.failure_count + 1 >= p_max_failures then 'paused'
        else sub.status
      end,
      claim_id = null,
      claimed_at = null,
      updated_at = pg_catalog.now()
  where sub.id = p_id
    and sub.claim_id = p_claim_id
    and sub.status = 'active'
  returning failure_count into v_failures;
  if not found then
    raise exception 'price alert claim was lost' using errcode = '22023';
  end if;

  insert into catalog.price_alert_sends (
    subscription_id, kind, old_price, new_price, status
  ) values (
    p_id, p_kind, p_old_price, p_new_price, 'failed'
  );
end
$$;

create function read_model.cleanup_price_alerts()
returns table (pending_deleted integer, expired_deleted integer, sends_deleted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
  v_expired integer;
  v_sends integer;
begin
  delete from catalog.price_alert_subscriptions sub
  where sub.status = 'pending'
    and sub.pending_expires_at is not null
    and sub.pending_expires_at < pg_catalog.now();
  get diagnostics v_pending = row_count;

  delete from catalog.price_alert_subscriptions sub
  where sub.status = 'active'
    and sub.expires_at is not null
    and sub.expires_at < pg_catalog.now();
  get diagnostics v_expired = row_count;

  delete from catalog.price_alert_sends send
  where send.created_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_sends = row_count;

  return query select v_pending, v_expired, v_sends;
end
$$;

create function read_model.suppress_price_alert_email(p_email_hash text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_email_hash is null
     or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_reason is null
     or p_reason not in ('bounce', 'complaint', 'manual')
  then
    raise exception 'invalid price alert suppression' using errcode = '22023';
  end if;

  insert into catalog.email_suppressions (email_hash, reason)
  values (p_email_hash, p_reason)
  on conflict (email_hash) do nothing;

  delete from catalog.price_alert_subscriptions sub
  where sub.email_hash = p_email_hash;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- public_site wrappers. INVOKER. Granted only to service_role.
-- ---------------------------------------------------------------------------

create function public_site.request_price_alert(
  p_email text,
  p_email_hash text,
  p_model_slug text,
  p_storage_gb integer,
  p_condition text,
  p_locale text,
  p_consent_text_version text,
  p_signup_ip_hash text,
  p_max_per_email integer,
  p_confirm_ttl_hours integer
)
returns table (id uuid, outcome text)
language sql
security invoker
set search_path = ''
as $$
  select * from read_model.request_price_alert(
    p_email, p_email_hash, p_model_slug, p_storage_gb, p_condition, p_locale,
    p_consent_text_version, p_signup_ip_hash, p_max_per_email, p_confirm_ttl_hours
  )
$$;

create function public_site.get_price_alert(p_id uuid)
returns table (
  id uuid,
  model_slug text,
  storage_gb integer,
  condition text,
  locale text,
  status text,
  pending_expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from read_model.get_price_alert(p_id) $$;

create function public_site.confirm_price_alert(
  p_id uuid,
  p_baseline_price integer,
  p_retention_days integer
)
returns text
language sql
security invoker
set search_path = ''
as $$ select read_model.confirm_price_alert(p_id, p_baseline_price, p_retention_days) $$;

create function public_site.delete_price_alert(p_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$ select read_model.delete_price_alert(p_id) $$;

create function public_site.delete_price_alerts_for_same_email(p_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$ select read_model.delete_price_alerts_for_same_email(p_id) $$;

create function public_site.list_due_price_alerts(p_limit integer)
returns table (
  id uuid,
  email text,
  email_hash text,
  model_slug text,
  storage_gb integer,
  condition text,
  locale text,
  baseline_price integer,
  last_alert_at timestamptz,
  failure_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from read_model.list_due_price_alerts(p_limit) $$;

create function public_site.mark_price_alerts_evaluated(p_ids uuid[])
returns integer
language sql
security invoker
set search_path = ''
as $$ select read_model.mark_price_alerts_evaluated(p_ids) $$;

create function public_site.claim_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_cooldown_hours integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select read_model.claim_price_alert(p_id, p_claim_id, p_cooldown_hours) $$;

create function public_site.finish_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_kind text,
  p_old_price integer,
  p_new_price integer,
  p_provider_message_id text,
  p_retention_days integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform read_model.finish_price_alert(
    p_id, p_claim_id, p_kind, p_old_price, p_new_price, p_provider_message_id, p_retention_days
  );
end
$$;

create function public_site.fail_price_alert(
  p_id uuid,
  p_claim_id uuid,
  p_max_failures integer,
  p_kind text,
  p_old_price integer,
  p_new_price integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform read_model.fail_price_alert(
    p_id, p_claim_id, p_max_failures, p_kind, p_old_price, p_new_price
  );
end
$$;

create function public_site.cleanup_price_alerts()
returns table (pending_deleted integer, expired_deleted integer, sends_deleted integer)
language sql
security invoker
set search_path = ''
as $$ select * from read_model.cleanup_price_alerts() $$;

create function public_site.suppress_price_alert_email(p_email_hash text, p_reason text)
returns integer
language sql
security invoker
set search_path = ''
as $$ select read_model.suppress_price_alert_email(p_email_hash, p_reason) $$;

revoke all on function read_model.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function read_model.get_price_alert(uuid) from public, anon, authenticated;
revoke all on function read_model.confirm_price_alert(uuid, integer, integer) from public, anon, authenticated;
revoke all on function read_model.delete_price_alert(uuid) from public, anon, authenticated;
revoke all on function read_model.delete_price_alerts_for_same_email(uuid) from public, anon, authenticated;
revoke all on function read_model.list_due_price_alerts(integer) from public, anon, authenticated;
revoke all on function read_model.mark_price_alerts_evaluated(uuid[]) from public, anon, authenticated;
revoke all on function read_model.claim_price_alert(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function read_model.finish_price_alert(uuid, uuid, text, integer, integer, text, integer) from public, anon, authenticated;
revoke all on function read_model.fail_price_alert(uuid, uuid, integer, text, integer, integer) from public, anon, authenticated;
revoke all on function read_model.cleanup_price_alerts() from public, anon, authenticated;
revoke all on function read_model.suppress_price_alert_email(text, text) from public, anon, authenticated;

revoke all on function public_site.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public_site.get_price_alert(uuid) from public, anon, authenticated;
revoke all on function public_site.confirm_price_alert(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public_site.delete_price_alert(uuid) from public, anon, authenticated;
revoke all on function public_site.delete_price_alerts_for_same_email(uuid) from public, anon, authenticated;
revoke all on function public_site.list_due_price_alerts(integer) from public, anon, authenticated;
revoke all on function public_site.mark_price_alerts_evaluated(uuid[]) from public, anon, authenticated;
revoke all on function public_site.claim_price_alert(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public_site.finish_price_alert(uuid, uuid, text, integer, integer, text, integer) from public, anon, authenticated;
revoke all on function public_site.fail_price_alert(uuid, uuid, integer, text, integer, integer) from public, anon, authenticated;
revoke all on function public_site.cleanup_price_alerts() from public, anon, authenticated;
revoke all on function public_site.suppress_price_alert_email(text, text) from public, anon, authenticated;

grant usage on schema read_model to service_role;
grant usage on schema public_site to service_role;

grant execute on function read_model.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer) to service_role;
grant execute on function read_model.get_price_alert(uuid) to service_role;
grant execute on function read_model.confirm_price_alert(uuid, integer, integer) to service_role;
grant execute on function read_model.delete_price_alert(uuid) to service_role;
grant execute on function read_model.delete_price_alerts_for_same_email(uuid) to service_role;
grant execute on function read_model.list_due_price_alerts(integer) to service_role;
grant execute on function read_model.mark_price_alerts_evaluated(uuid[]) to service_role;
grant execute on function read_model.claim_price_alert(uuid, uuid, integer) to service_role;
grant execute on function read_model.finish_price_alert(uuid, uuid, text, integer, integer, text, integer) to service_role;
grant execute on function read_model.fail_price_alert(uuid, uuid, integer, text, integer, integer) to service_role;
grant execute on function read_model.cleanup_price_alerts() to service_role;
grant execute on function read_model.suppress_price_alert_email(text, text) to service_role;

grant execute on function public_site.request_price_alert(text, text, text, integer, text, text, text, text, integer, integer) to service_role;
grant execute on function public_site.get_price_alert(uuid) to service_role;
grant execute on function public_site.confirm_price_alert(uuid, integer, integer) to service_role;
grant execute on function public_site.delete_price_alert(uuid) to service_role;
grant execute on function public_site.delete_price_alerts_for_same_email(uuid) to service_role;
grant execute on function public_site.list_due_price_alerts(integer) to service_role;
grant execute on function public_site.mark_price_alerts_evaluated(uuid[]) to service_role;
grant execute on function public_site.claim_price_alert(uuid, uuid, integer) to service_role;
grant execute on function public_site.finish_price_alert(uuid, uuid, text, integer, integer, text, integer) to service_role;
grant execute on function public_site.fail_price_alert(uuid, uuid, integer, text, integer, integer) to service_role;
grant execute on function public_site.cleanup_price_alerts() to service_role;
grant execute on function public_site.suppress_price_alert_email(text, text) to service_role;

commit;

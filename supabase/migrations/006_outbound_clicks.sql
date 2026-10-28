-- 006_outbound_clicks
-- Private click log and the two RPCs the redirect uses.
-- resolve_offer and record_click are granted only to service_role (the secret key).
-- anon and authenticated cannot call them and cannot read the log.
-- The price and the destination are read from the database inside these functions.
-- Rollback: supabase/rollbacks/006_outbound_clicks.down.sql

begin;

create table catalog.outbound_clicks (
  click_id uuid primary key,
  offer_ref text not null check (offer_ref ~ '^[0-9a-f]{24}$'),
  company_slug text not null,
  model_slug text not null,
  storage_gb integer not null check (storage_gb between 1 and 16384),
  grade text not null check (grade in ('A', 'B', 'C', 'D')),
  price integer not null check (price > 0),
  locale text not null check (locale in ('he', 'en')),
  user_id uuid,
  ip_ua_hash text check (ip_ua_hash ~ '^[0-9a-f]{64}$'),
  referrer_path text check (
    referrer_path ~ '^/([A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*)?$'
    and char_length(referrer_path) <= 180
    and strpos(referrer_path, '..') = 0
  ),
  url_params jsonb not null check (jsonb_typeof(url_params) = 'object'),
  created_at timestamptz not null default now()
);

create index outbound_clicks_created_at_idx on catalog.outbound_clicks (created_at);

alter table catalog.outbound_clicks enable row level security;
revoke all on table catalog.outbound_clicks from public, anon, authenticated, service_role;

-- Deletes clicks older than 13 months. Run monthly from the SQL editor until a
-- scheduler is attached. Not granted to API roles.
create function catalog.purge_outbound_clicks()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from catalog.outbound_clicks
    where created_at < now() - interval '13 months'
    returning 1
  )
  select count(*)::integer from deleted
$$;

revoke all on function catalog.purge_outbound_clicks() from public, anon, authenticated, service_role;

create function read_model.resolve_offer(p_offer_ref text)
returns table (
  offer_ref text,
  company_slug text,
  brand text,
  model_slug text,
  storage_gb integer,
  grade text,
  price integer,
  destination_url text,
  allowed_hosts text[],
  tracking_mode text,
  click_id_param text,
  static_params jsonb,
  utm_source_override text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.offer_ref,
    v.company_slug,
    v.brand,
    v.model_slug,
    v.storage_gb,
    v.grade,
    v.price,
    pt.destination_url,
    pt.allowed_hosts,
    pt.tracking_mode,
    pt.click_id_param,
    pt.static_params,
    pt.utm_source_override
  from catalog.visible_offers() v
  join catalog.partner_tracking pt on pt.company_id = v.company_id and pt.is_active
  where p_offer_ref ~ '^[0-9a-f]{24}$'
    and v.offer_ref = p_offer_ref
    and catalog.url_host(pt.destination_url) = any (pt.allowed_hosts)
  limit 1
$$;

create function read_model.record_click(
  p_click_id uuid,
  p_offer_ref text,
  p_locale text,
  p_ip_ua_hash text,
  p_referrer_path text,
  p_url_params jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_ref text;
  v_company text;
  v_model text;
  v_storage integer;
  v_grade text;
  v_price integer;
begin
  if p_click_id is null
     or p_offer_ref is null
     or p_offer_ref !~ '^[0-9a-f]{24}$'
     or p_locale is null
     or p_locale not in ('he', 'en') then
    raise exception 'invalid click' using errcode = '22023';
  end if;
  if p_ip_ua_hash is not null and p_ip_ua_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid click' using errcode = '22023';
  end if;
  if p_referrer_path is not null and (
    p_referrer_path !~ '^/([A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*)?$'
    or char_length(p_referrer_path) > 180
    or strpos(p_referrer_path, '..') > 0
  ) then
    raise exception 'invalid click' using errcode = '22023';
  end if;
  if p_url_params is null
     or jsonb_typeof(p_url_params) <> 'object'
     or (select count(*) from jsonb_object_keys(p_url_params)) > 30
     or octet_length(p_url_params::text) > 4000
     or exists (
       select 1
       from jsonb_each(p_url_params) as param(key, value)
       where jsonb_typeof(param.value) <> 'string'
          or param.key !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'
          or char_length(param.value #>> '{}') > 200
          or char_length(param.value #>> '{}') < 1
          or param.value #>> '{}' ~ '[[:space:]@[:cntrl:]]'
     ) then
    raise exception 'invalid click' using errcode = '22023';
  end if;

  select v.offer_ref, v.company_slug, v.model_slug, v.storage_gb, v.grade, v.price
  into v_offer_ref, v_company, v_model, v_storage, v_grade, v_price
  from catalog.visible_offers() v
  where v.offer_ref = p_offer_ref;

  if not found then
    raise exception 'unknown offer' using errcode = '22023';
  end if;

  insert into catalog.outbound_clicks (
    click_id, offer_ref, company_slug, model_slug, storage_gb, grade, price,
    locale, user_id, ip_ua_hash, referrer_path, url_params
  ) values (
    p_click_id, v_offer_ref, v_company, v_model, v_storage, v_grade, v_price,
    p_locale, null, p_ip_ua_hash, p_referrer_path, p_url_params
  );
end
$$;

create function public_site.resolve_offer(p_offer_ref text)
returns table (
  offer_ref text,
  company_slug text,
  brand text,
  model_slug text,
  storage_gb integer,
  grade text,
  price integer,
  destination_url text,
  allowed_hosts text[],
  tracking_mode text,
  click_id_param text,
  static_params jsonb,
  utm_source_override text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from read_model.resolve_offer(p_offer_ref) $$;

create function public_site.record_click(
  p_click_id uuid,
  p_offer_ref text,
  p_locale text,
  p_ip_ua_hash text,
  p_referrer_path text,
  p_url_params jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform read_model.record_click(p_click_id, p_offer_ref, p_locale, p_ip_ua_hash, p_referrer_path, p_url_params);
end
$$;

revoke all on function read_model.resolve_offer(text) from public, anon, authenticated;
revoke all on function read_model.record_click(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public_site.resolve_offer(text) from public, anon, authenticated;
revoke all on function public_site.record_click(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

grant usage on schema read_model to service_role;
grant usage on schema public_site to service_role;
grant execute on function read_model.resolve_offer(text) to service_role;
grant execute on function read_model.record_click(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public_site.resolve_offer(text) to service_role;
grant execute on function public_site.record_click(uuid, text, text, text, text, jsonb) to service_role;

commit;

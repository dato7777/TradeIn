-- 004_public_read_model
-- Read-only public API for the public site.
--
--   catalog.*      private helpers (SECURITY INVOKER, no API-role access)
--   read_model.*   private SECURITY DEFINER functions, owned by postgres; the only
--                  code that reads admin/scraper tables. Not exposed by the API.
--   public_site.*  exposed schema: thin SECURITY INVOKER wrappers around read_model.
--
-- All data-quality rules live in catalog.visible_offers(): positive prices only,
-- active companies only, https destination on an allowlisted host, freshness
-- window, hidden models and per-offer overrides.
-- Additive only. Rollback: supabase/rollbacks/004_public_read_model.down.sql

begin;

-- ---------------------------------------------------------------------------
-- catalog helpers
-- ---------------------------------------------------------------------------

create function catalog.model_slug(p_brand text, p_model text)
returns text
language sql immutable
set search_path = ''
as $$
  select case p_brand when 'apple' then 'iphone-' when 'samsung' then 'galaxy-' end
    || nullif(
         btrim(regexp_replace(lower(replace(p_model, '+', ' plus ')), '[^a-z0-9]+', '-', 'g'), '-'),
         '')
$$;

create function catalog.model_display_name(p_brand text, p_model text)
returns text
language sql immutable
set search_path = ''
as $$
  select case p_brand when 'apple' then 'iPhone ' when 'samsung' then 'Galaxy ' end
    || btrim(p_model)
$$;

create function catalog.storage_to_gb(p_storage text)
returns integer
language sql immutable
set search_path = ''
as $$
  select case
    when p_storage ~* '^\s*\d{1,5}\s*TB\s*$' then substring(p_storage from '\d+')::integer * 1024
    when p_storage ~* '^\s*\d{1,5}\s*GB\s*$' then substring(p_storage from '\d+')::integer
  end
$$;

-- Host of an https URL without userinfo or port; NULL otherwise.
create function catalog.url_host(p_url text)
returns text
language sql immutable
set search_path = ''
as $$
  select lower(substring(p_url from '^https://([A-Za-z0-9.-]+)(?:[/?#]|$)'))
$$;

-- Stable, opaque offer reference. Survives delete-and-reinsert scrapes.
create function catalog.offer_ref(p_company_slug text, p_model_slug text, p_storage_gb integer, p_grade text)
returns text
language sql immutable
set search_path = ''
as $$
  select substr(encode(sha256(convert_to(
    concat_ws('|', 'v1', p_company_slug, p_model_slug, p_storage_gb::text, p_grade), 'UTF8')), 'hex'), 1, 24)
$$;

create function catalog.visible_offers()
returns table (
  offer_ref text,
  company_id uuid,
  company_slug text,
  brand text,
  model_slug text,
  source_model text,
  storage_gb integer,
  grade text,
  company_grade_label text,
  price integer,
  last_updated_at timestamptz,
  is_stale boolean
)
language sql stable
set search_path = ''
as $$
  with settings as (
    select s.price_fresh_hours, s.price_hide_hours
    from catalog.settings s
    where s.id
  ),
  eligible_companies as (
    select co.id, co.slug, co.grade_columns
    from public.companies co
    join catalog.company_public_profiles pp on pp.company_id = co.id and pp.is_active
    join catalog.partner_tracking pt on pt.company_id = co.id and pt.is_active
    where catalog.url_host(pt.destination_url) = any (pt.allowed_hosts)
  ),
  priced as (
    select
      ec.id as company_id,
      ec.slug as company_slug,
      ec.grade_columns,
      cp.brand,
      btrim(cp.model) as source_model,
      cp.grade as grade_key,
      cp.price,
      coalesce(ma.model_slug, catalog.model_slug(cp.brand, cp.model)) as model_slug,
      catalog.storage_to_gb(cp.storage_gb) as storage_gb,
      coalesce(cp.scraped_at, cp.uploaded_at, cp.created_at) as updated_at
    from public.company_prices cp
    join eligible_companies ec on ec.id = cp.company_id
    left join catalog.model_aliases ma on ma.brand = cp.brand and ma.source_model = btrim(cp.model)
    where cp.price > 0
      and nullif(btrim(cp.model), '') is not null
  ),
  graded as (
    select p.*, cg.grade, gc.elem ->> 'label' as company_grade_label
    from priced p
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p.grade_columns) = 'array' then p.grade_columns else '[]'::jsonb end
    ) as gc (elem)
    join catalog.condition_grades cg on cg.tier::text = gc.elem ->> 'summary_tier'
    where gc.elem ->> 'key' = p.grade_key
  )
  select distinct on (g.company_id, g.model_slug, g.storage_gb, g.grade)
    catalog.offer_ref(g.company_slug, g.model_slug, g.storage_gb, g.grade),
    g.company_id,
    g.company_slug,
    g.brand,
    g.model_slug,
    g.source_model,
    g.storage_gb,
    g.grade,
    g.company_grade_label,
    g.price,
    g.updated_at,
    g.updated_at < now() - make_interval(hours => s.price_fresh_hours)
  from graded g
  cross join settings s
  left join catalog.model_overrides mo on mo.model_slug = g.model_slug
  where g.storage_gb is not null
    and g.model_slug is not null
    and g.updated_at >= now() - make_interval(hours => s.price_hide_hours)
    and not coalesce(mo.is_hidden, false)
    and not exists (
      select 1
      from catalog.offer_publication_overrides o
      where o.is_hidden
        and o.company_id = g.company_id
        and o.model_slug = g.model_slug
        and (o.storage_gb is null or o.storage_gb = g.storage_gb)
        and (o.grade is null or o.grade = g.grade)
    )
  order by g.company_id, g.model_slug, g.storage_gb, g.grade, g.price desc, g.updated_at desc
$$;

create function catalog.visible_models()
returns table (
  model_slug text,
  brand text,
  display_name_he text,
  display_name_en text,
  release_year smallint,
  image_url text,
  top_price integer,
  min_price integer,
  company_count integer,
  storage_options integer[],
  last_updated_at timestamptz,
  popularity smallint
)
language sql stable
set search_path = ''
as $$
  with agg as (
    select
      v.model_slug,
      min(v.brand) as brand,
      (array_agg(v.source_model order by char_length(v.source_model), v.source_model))[1] as source_model,
      max(v.price) as top_price,
      min(v.price) as min_price,
      count(distinct v.company_id)::integer as company_count,
      array_agg(distinct v.storage_gb order by v.storage_gb) as storage_options,
      max(v.last_updated_at) as last_updated_at
    from catalog.visible_offers() v
    group by v.model_slug
  )
  select
    a.model_slug,
    a.brand,
    coalesce(mo.display_name_he, catalog.model_display_name(a.brand, a.source_model)),
    coalesce(mo.display_name_en, catalog.model_display_name(a.brand, a.source_model)),
    mo.release_year,
    mo.image_url,
    a.top_price,
    a.min_price,
    a.company_count,
    a.storage_options,
    a.last_updated_at,
    coalesce(mo.popularity, 0::smallint)
  from agg a
  left join catalog.model_overrides mo on mo.model_slug = a.model_slug
$$;

-- ---------------------------------------------------------------------------
-- read_model: private SECURITY DEFINER layer
-- ---------------------------------------------------------------------------

create schema read_model;
revoke all on schema read_model from public;

create type read_model.brand_row as (
  brand text,
  model_count integer,
  top_price integer
);

create type read_model.model_row as (
  model_slug text,
  brand text,
  display_name_he text,
  display_name_en text,
  release_year smallint,
  image_url text,
  top_price integer,
  min_price integer,
  company_count integer,
  storage_options integer[],
  last_updated_at timestamptz
);

create type read_model.offer_row as (
  offer_ref text,
  company_slug text,
  company_name_he text,
  company_name_en text,
  logo_url text,
  price integer,
  payout_methods text[],
  payout_time_he text,
  payout_time_en text,
  delivery_methods text[],
  last_updated_at timestamptz,
  is_stale boolean,
  company_grade_label text,
  policy_summary_he text,
  policy_summary_en text,
  policy_url text
);

create type read_model.grade_row as (
  grade text,
  name_he text,
  name_en text,
  description_he text,
  description_en text
);

create type read_model.company_row as (
  company_slug text,
  name_he text,
  name_en text,
  logo_url text,
  website_url text,
  payout_methods text[],
  payout_time_he text,
  payout_time_en text,
  delivery_methods text[],
  offer_count integer,
  last_updated_at timestamptz
);

create type read_model.policy_row as (
  company_slug text,
  grade text,
  company_grade_label text,
  summary_he text,
  summary_en text,
  policy_url text
);

create type read_model.search_row as (
  model_slug text,
  brand text,
  display_name_he text,
  display_name_en text,
  top_price integer
);

create function read_model.list_brands()
returns setof read_model.brand_row
language sql stable security definer
set search_path = ''
as $$
  select v.brand, count(distinct v.model_slug)::integer, max(v.price)
  from catalog.visible_offers() v
  group by v.brand
  order by v.brand
$$;

create function read_model.list_models(p_brand text, p_limit integer, p_offset integer)
returns setof read_model.model_row
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_brand is null or p_brand not in ('apple', 'samsung') then
    raise exception 'invalid brand' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid pagination' using errcode = '22023';
  end if;

  return query
    select m.model_slug, m.brand, m.display_name_he, m.display_name_en, m.release_year,
           m.image_url, m.top_price, m.min_price, m.company_count, m.storage_options,
           m.last_updated_at
    from catalog.visible_models() m
    where m.brand = p_brand
    order by m.popularity desc, m.release_year desc nulls last, m.top_price desc, m.model_slug
    limit p_limit offset p_offset;
end
$$;

create function read_model.get_model(p_model_slug text)
returns setof read_model.model_row
language sql stable security definer
set search_path = ''
as $$
  select m.model_slug, m.brand, m.display_name_he, m.display_name_en, m.release_year,
         m.image_url, m.top_price, m.min_price, m.company_count, m.storage_options,
         m.last_updated_at
  from catalog.visible_models() m
  where p_model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_model_slug) <= 80
    and m.model_slug = p_model_slug
$$;

create function read_model.offers_for(p_model_slug text, p_storage_gb integer, p_grade text)
returns setof read_model.offer_row
language sql stable security definer
set search_path = ''
as $$
  select
    v.offer_ref,
    v.company_slug,
    coalesce(pp.display_name_he, co.name),
    coalesce(pp.display_name_en, co.name),
    pp.logo_url,
    v.price,
    pp.payout_methods,
    pp.payout_time_he,
    pp.payout_time_en,
    pp.delivery_methods,
    v.last_updated_at,
    v.is_stale,
    v.company_grade_label,
    ccp.summary_he,
    ccp.summary_en,
    ccp.policy_url
  from catalog.visible_offers() v
  join public.companies co on co.id = v.company_id
  join catalog.company_public_profiles pp on pp.company_id = v.company_id
  left join catalog.company_condition_policies ccp
    on ccp.company_id = v.company_id and ccp.grade = v.grade
  where p_model_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_model_slug) <= 80
    and p_storage_gb between 1 and 16384
    and p_grade in ('A', 'B', 'C', 'D')
    and v.model_slug = p_model_slug
    and v.storage_gb = p_storage_gb
    and v.grade = p_grade
  order by v.price desc, v.last_updated_at desc, v.company_slug
  limit 50
$$;

create function read_model.list_condition_grades()
returns setof read_model.grade_row
language sql stable security definer
set search_path = ''
as $$
  select g.grade, g.name_he, g.name_en, g.description_he, g.description_en
  from catalog.condition_grades g
  order by g.tier
$$;

create function read_model.list_companies()
returns setof read_model.company_row
language sql stable security definer
set search_path = ''
as $$
  with stats as (
    select v.company_id, count(*)::integer as offer_count, max(v.last_updated_at) as last_updated_at
    from catalog.visible_offers() v
    group by v.company_id
  )
  select
    co.slug,
    coalesce(pp.display_name_he, co.name),
    coalesce(pp.display_name_en, co.name),
    pp.logo_url,
    pp.website_url,
    pp.payout_methods,
    pp.payout_time_he,
    pp.payout_time_en,
    pp.delivery_methods,
    coalesce(s.offer_count, 0),
    s.last_updated_at
  from public.companies co
  join catalog.company_public_profiles pp on pp.company_id = co.id and pp.is_active
  left join stats s on s.company_id = co.id
  order by coalesce(pp.display_name_en, co.name)
  limit 100
$$;

create function read_model.list_condition_policies()
returns setof read_model.policy_row
language sql stable security definer
set search_path = ''
as $$
  select
    co.slug,
    cg.grade,
    (
      select string_agg(e ->> 'label', ' / ' order by e ->> 'key')
      from jsonb_array_elements(
        case when jsonb_typeof(co.grade_columns) = 'array' then co.grade_columns else '[]'::jsonb end
      ) as e
      where e ->> 'summary_tier' = cg.tier::text
    ),
    ccp.summary_he,
    ccp.summary_en,
    ccp.policy_url
  from public.companies co
  join catalog.company_public_profiles pp on pp.company_id = co.id and pp.is_active
  cross join catalog.condition_grades cg
  left join catalog.company_condition_policies ccp
    on ccp.company_id = co.id and ccp.grade = cg.grade
  order by co.slug, cg.tier
  limit 400
$$;

create function read_model.search_models(p_query text)
returns setof read_model.search_row
language plpgsql stable security definer
set search_path = ''
as $$
declare
  q text;
  pattern text;
begin
  q := btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  if char_length(q) < 2 or char_length(q) > 64 then
    return;
  end if;

  -- Common Hebrew and brand-prefixed spellings.
  q := regexp_replace(q, '(samsung|סמסונג)(\s+(galaxy|גלקסי))?', 'galaxy', 'gi');
  q := regexp_replace(q, 'גלקסי', 'galaxy', 'g');
  q := regexp_replace(q, 'אייפון|איפון', 'iphone', 'g');

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select m.model_slug, m.brand, m.display_name_he, m.display_name_en, m.top_price
    from catalog.visible_models() m
    where m.display_name_en ilike pattern escape '\'
       or m.display_name_he ilike pattern escape '\'
       or replace(m.model_slug, '-', ' ') ilike pattern escape '\'
    order by m.popularity desc, m.top_price desc, m.model_slug
    limit 8;
end
$$;

-- ---------------------------------------------------------------------------
-- public_site: exposed SECURITY INVOKER wrappers
-- ---------------------------------------------------------------------------

create schema public_site;
revoke all on schema public_site from public;

create function public_site.list_brands()
returns setof read_model.brand_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.list_brands() $$;

create function public_site.list_models(p_brand text, p_limit integer default 60, p_offset integer default 0)
returns setof read_model.model_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.list_models(p_brand, p_limit, p_offset) $$;

create function public_site.get_model(p_model_slug text)
returns setof read_model.model_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.get_model(p_model_slug) $$;

create function public_site.offers_for(p_model_slug text, p_storage_gb integer, p_grade text)
returns setof read_model.offer_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.offers_for(p_model_slug, p_storage_gb, p_grade) $$;

create function public_site.list_condition_grades()
returns setof read_model.grade_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.list_condition_grades() $$;

create function public_site.list_companies()
returns setof read_model.company_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.list_companies() $$;

create function public_site.list_condition_policies()
returns setof read_model.policy_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.list_condition_policies() $$;

create function public_site.search_models(p_query text)
returns setof read_model.search_row
language sql stable security invoker
set search_path = ''
as $$ select * from read_model.search_models(p_query) $$;

-- ---------------------------------------------------------------------------
-- Privileges: deny by default, then grant exactly what the site needs.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema catalog from public, anon, authenticated;
revoke execute on all functions in schema read_model from public, anon, authenticated;
revoke execute on all functions in schema public_site from public, anon, authenticated;

alter default privileges for role postgres in schema read_model
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public_site
  revoke execute on functions from public, anon, authenticated;

grant usage on schema read_model to anon, authenticated;
grant usage on schema public_site to anon, authenticated;

grant execute on function
  read_model.list_brands(),
  read_model.list_models(text, integer, integer),
  read_model.get_model(text),
  read_model.offers_for(text, integer, text),
  read_model.list_condition_grades(),
  read_model.list_companies(),
  read_model.list_condition_policies(),
  read_model.search_models(text),
  public_site.list_brands(),
  public_site.list_models(text, integer, integer),
  public_site.get_model(text),
  public_site.offers_for(text, integer, text),
  public_site.list_condition_grades(),
  public_site.list_companies(),
  public_site.list_condition_policies(),
  public_site.search_models(text)
to anon, authenticated;

commit;

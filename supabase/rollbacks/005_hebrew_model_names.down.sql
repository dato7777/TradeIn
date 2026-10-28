-- Rollback for 005_hebrew_model_names. Restores English display_name_he
-- and the previous search normalizer.

begin;

create or replace function catalog.visible_models()
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

create or replace function read_model.search_models(p_query text)
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

drop function catalog.hebrew_model_name(text);

commit;

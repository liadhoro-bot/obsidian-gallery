create extension if not exists pgcrypto;

alter table public.paint_catalog
add column if not exists normalized_name text,
add column if not exists normalized_brand text,
add column if not exists normalized_line text,
add column if not exists color_family text,
add column if not exists finish_type text default 'standard',
add column if not exists is_color_matchable boolean not null default true,
add column if not exists is_conversion_matchable boolean not null default true,
add column if not exists lab_l numeric,
add column if not exists lab_a numeric,
add column if not exists lab_b numeric;

create table if not exists public.paint_conversion_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  source_type text not null default 'official_chart',
  source_url text,
  file_path text,
  notes text,
  reliability_score numeric(4,3) not null default 1.000,
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paint_conversion_raw_rows (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.paint_conversion_sources(id) on delete cascade,
  source_brand_raw text,
  source_line_raw text,
  source_paint_name_raw text,
  source_code_raw text,
  target_brand_raw text,
  target_line_raw text,
  target_paint_name_raw text,
  target_code_raw text,
  notes_raw text,
  row_number int,
  match_status text not null default 'unmatched',
  source_paint_id uuid references public.paint_catalog(id),
  target_paint_id uuid references public.paint_catalog(id),
  created_at timestamptz not null default now()
);

create table if not exists public.paint_aliases (
  id uuid primary key default gen_random_uuid(),
  paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  alias_brand text,
  alias_line text,
  alias_name text not null,
  alias_code text,
  normalized_alias_brand text,
  normalized_alias_line text,
  normalized_alias_name text not null,
  source text,
  confidence_score numeric(5,4) not null default 1.000,
  created_at timestamptz not null default now()
);

create table if not exists public.paint_conversion_edges (
  id uuid primary key default gen_random_uuid(),
  source_paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  target_paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  source_id uuid references public.paint_conversion_sources(id) on delete set null,
  raw_row_id uuid references public.paint_conversion_raw_rows(id) on delete set null,
  connection_type text not null,
  direction text not null default 'bidirectional',
  confidence_score numeric(5,4) not null default 0.750,
  distance_delta_e numeric(8,4),
  distance_rgb numeric(8,4),
  reason text,
  is_active boolean not null default true,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paint_similarity_rankings (
  id uuid primary key default gen_random_uuid(),
  paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  similar_paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  overall_score numeric(6,4) not null,
  official_score numeric(6,4) not null default 0,
  hex_score numeric(6,4) not null default 0,
  manual_score numeric(6,4) not null default 0,
  penalty_score numeric(6,4) not null default 0,
  best_connection_type text,
  source_count int not null default 0,
  min_delta_e numeric(8,4),
  avg_delta_e numeric(8,4),
  explanation text,
  is_hidden boolean not null default false,
  needs_review boolean not null default false,
  calculated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'paint_conversion_edges_distinct_paints_check'
      and conrelid = 'public.paint_conversion_edges'::regclass
  ) then
    alter table public.paint_conversion_edges
    add constraint paint_conversion_edges_distinct_paints_check
    check (source_paint_id <> target_paint_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'paint_similarity_rankings_distinct_paints_check'
      and conrelid = 'public.paint_similarity_rankings'::regclass
  ) then
    alter table public.paint_similarity_rankings
    add constraint paint_similarity_rankings_distinct_paints_check
    check (paint_id <> similar_paint_id);
  end if;
end $$;

create index if not exists paint_catalog_matchable_idx
on public.paint_catalog (is_color_matchable, is_conversion_matchable);

create index if not exists paint_catalog_brand_line_idx
on public.paint_catalog (brand, line);

create index if not exists paint_catalog_normalized_name_idx
on public.paint_catalog (normalized_name);

create index if not exists paint_catalog_finish_type_idx
on public.paint_catalog (finish_type);

create index if not exists paint_catalog_lab_matchable_idx
on public.paint_catalog (lab_l, lab_a, lab_b)
where is_color_matchable = true
  and lab_l is not null
  and lab_a is not null
  and lab_b is not null;

create index if not exists paint_conversion_sources_manufacturer_idx
on public.paint_conversion_sources (manufacturer);

create index if not exists paint_conversion_sources_source_type_idx
on public.paint_conversion_sources (source_type);

create index if not exists paint_conversion_sources_manufacturer_source_type_idx
on public.paint_conversion_sources (manufacturer, source_type);

create index if not exists paint_conversion_raw_rows_source_id_idx
on public.paint_conversion_raw_rows (source_id);

create index if not exists paint_conversion_raw_rows_match_status_idx
on public.paint_conversion_raw_rows (match_status);

create index if not exists paint_conversion_raw_rows_source_paint_id_idx
on public.paint_conversion_raw_rows (source_paint_id);

create index if not exists paint_conversion_raw_rows_target_paint_id_idx
on public.paint_conversion_raw_rows (target_paint_id);

create index if not exists paint_conversion_raw_rows_source_name_lower_idx
on public.paint_conversion_raw_rows (lower(source_paint_name_raw));

create index if not exists paint_conversion_raw_rows_target_name_lower_idx
on public.paint_conversion_raw_rows (lower(target_paint_name_raw));

create index if not exists paint_conversion_raw_rows_source_raw_lookup_idx
on public.paint_conversion_raw_rows (
  source_id,
  lower(source_brand_raw),
  lower(source_line_raw),
  lower(source_paint_name_raw),
  lower(source_code_raw)
);

create index if not exists paint_conversion_raw_rows_target_raw_lookup_idx
on public.paint_conversion_raw_rows (
  source_id,
  lower(target_brand_raw),
  lower(target_line_raw),
  lower(target_paint_name_raw),
  lower(target_code_raw)
);

create index if not exists paint_aliases_normalized_name_idx
on public.paint_aliases (normalized_alias_name);

create index if not exists paint_aliases_normalized_brand_line_name_idx
on public.paint_aliases (normalized_alias_brand, normalized_alias_line, normalized_alias_name);

create index if not exists paint_aliases_paint_id_idx
on public.paint_aliases (paint_id);

create index if not exists paint_conversion_edges_source_paint_id_idx
on public.paint_conversion_edges (source_paint_id);

create index if not exists paint_conversion_edges_target_paint_id_idx
on public.paint_conversion_edges (target_paint_id);

create index if not exists paint_conversion_edges_connection_type_idx
on public.paint_conversion_edges (connection_type);

create index if not exists paint_conversion_edges_confidence_score_idx
on public.paint_conversion_edges (confidence_score);

create index if not exists paint_conversion_edges_needs_review_idx
on public.paint_conversion_edges (needs_review);

create unique index if not exists paint_conversion_edges_unique_per_source_idx
on public.paint_conversion_edges (
  source_paint_id,
  target_paint_id,
  connection_type,
  coalesce(source_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create unique index if not exists paint_similarity_rankings_paint_pair_uidx
on public.paint_similarity_rankings (paint_id, similar_paint_id);

create index if not exists paint_similarity_rankings_visible_score_idx
on public.paint_similarity_rankings (paint_id, overall_score desc)
where is_hidden = false;

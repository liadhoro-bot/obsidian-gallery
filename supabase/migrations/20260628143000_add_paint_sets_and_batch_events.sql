create table if not exists public.paint_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  line text,
  manufacturer text,
  description text,
  product_code text,
  barcode text,
  image_url text,
  source_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paint_set_items (
  id uuid primary key default gen_random_uuid(),
  paint_set_id uuid not null references public.paint_sets(id) on delete cascade,
  paint_id uuid not null references public.paint_catalog(id) on delete cascade,
  source_product_code text,
  item_role text,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (paint_set_id, paint_id)
);

alter table public.paint_set_items
add column if not exists source_product_code text;

alter table public.paint_set_items
add column if not exists item_role text;

create table if not exists public.user_paint_set_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paint_set_id uuid references public.paint_sets(id) on delete set null,
  action text not null,
  affected_paint_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists paint_sets_brand_idx
  on public.paint_sets (brand);

create index if not exists paint_sets_line_idx
  on public.paint_sets (line);

create index if not exists paint_sets_is_active_idx
  on public.paint_sets (is_active);

create unique index if not exists paint_sets_product_code_key
  on public.paint_sets (product_code);

create index if not exists paint_set_items_paint_set_id_idx
  on public.paint_set_items (paint_set_id);

create index if not exists paint_set_items_paint_id_idx
  on public.paint_set_items (paint_id);

do $$
begin
  create extension if not exists pg_trgm;

  create index if not exists paint_sets_name_trgm_idx
    on public.paint_sets using gin (name gin_trgm_ops);
exception
  when undefined_file or insufficient_privilege then
    raise notice 'pg_trgm is not available; skipping paint_sets name trigram index';
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_paint_sets_updated_at on public.paint_sets;
create trigger set_paint_sets_updated_at
before update on public.paint_sets
for each row execute function public.set_updated_at();

alter table public.paint_sets enable row level security;
alter table public.paint_set_items enable row level security;
alter table public.user_paint_set_events enable row level security;

drop policy if exists "Authenticated users can read active paint sets"
  on public.paint_sets;
create policy "Authenticated users can read active paint sets"
  on public.paint_sets
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can read paint set items"
  on public.paint_set_items;
create policy "Authenticated users can read paint set items"
  on public.paint_set_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.paint_sets
      where paint_sets.id = paint_set_items.paint_set_id
        and paint_sets.is_active = true
    )
  );

drop policy if exists "Users can read their own paint set events"
  on public.user_paint_set_events;
create policy "Users can read their own paint set events"
  on public.user_paint_set_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own paint set events"
  on public.user_paint_set_events;
create policy "Users can insert their own paint set events"
  on public.user_paint_set_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

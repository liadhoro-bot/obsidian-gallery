alter table public.paints
add column if not exists description text;

create table if not exists public.custom_paint_mix_paints (
  id uuid primary key default gen_random_uuid(),
  custom_paint_id uuid not null references public.paints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paint_source text not null check (paint_source in ('catalog', 'custom')),
  catalog_paint_id uuid references public.paint_catalog(id) on delete cascade,
  source_custom_paint_id uuid references public.paints(id) on delete cascade,
  paint_order integer not null check (paint_order between 1 and 3),
  ratio_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_paint_mix_paints_source_check check (
    (paint_source = 'catalog' and catalog_paint_id is not null and source_custom_paint_id is null)
    or
    (paint_source = 'custom' and catalog_paint_id is null and source_custom_paint_id is not null)
  ),
  constraint custom_paint_mix_paints_no_self_reference check (
    source_custom_paint_id is null or source_custom_paint_id <> custom_paint_id
  ),
  constraint custom_paint_mix_paints_unique_order unique (custom_paint_id, paint_order)
);

create index if not exists custom_paint_mix_paints_user_id_idx
on public.custom_paint_mix_paints(user_id);

create index if not exists custom_paint_mix_paints_custom_paint_id_idx
on public.custom_paint_mix_paints(custom_paint_id);

alter table public.custom_paint_mix_paints enable row level security;

drop policy if exists "Users can read own custom paint mix paints"
on public.custom_paint_mix_paints;
create policy "Users can read own custom paint mix paints"
on public.custom_paint_mix_paints
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.paints p
    where p.id = custom_paint_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own custom paint mix paints"
on public.custom_paint_mix_paints;
create policy "Users can insert own custom paint mix paints"
on public.custom_paint_mix_paints
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.paints p
    where p.id = custom_paint_id
      and p.user_id = auth.uid()
  )
  and (
    paint_source <> 'custom'
    or exists (
      select 1
      from public.paints p
      where p.id = source_custom_paint_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own custom paint mix paints"
on public.custom_paint_mix_paints;
create policy "Users can update own custom paint mix paints"
on public.custom_paint_mix_paints
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.paints p
    where p.id = custom_paint_id
      and p.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.paints p
    where p.id = custom_paint_id
      and p.user_id = auth.uid()
  )
  and (
    paint_source <> 'custom'
    or exists (
      select 1
      from public.paints p
      where p.id = source_custom_paint_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own custom paint mix paints"
on public.custom_paint_mix_paints;
create policy "Users can delete own custom paint mix paints"
on public.custom_paint_mix_paints
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.paints p
    where p.id = custom_paint_id
      and p.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

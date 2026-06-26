alter table public.paint_conversion_sources enable row level security;
alter table public.paint_conversion_edges enable row level security;
alter table public.paint_similarity_rankings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'paint_conversion_sources'
      and policyname = 'paint_conversion_sources_public_read'
  ) then
    create policy paint_conversion_sources_public_read
    on public.paint_conversion_sources
    for select
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'paint_conversion_edges'
      and policyname = 'paint_conversion_edges_public_read_active'
  ) then
    create policy paint_conversion_edges_public_read_active
    on public.paint_conversion_edges
    for select
    using (is_active = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'paint_similarity_rankings'
      and policyname = 'paint_similarity_rankings_public_read_visible'
  ) then
    create policy paint_similarity_rankings_public_read_visible
    on public.paint_similarity_rankings
    for select
    using (is_hidden = false);
  end if;
end $$;

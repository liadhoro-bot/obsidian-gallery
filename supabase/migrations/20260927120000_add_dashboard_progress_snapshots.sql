create table if not exists public.dashboard_progress_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  achievement_metrics jsonb not null default '{}'::jsonb,
  painting_days text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_progress_snapshots enable row level security;

drop policy if exists "Users can read their own dashboard progress snapshot"
  on public.dashboard_progress_snapshots;
create policy "Users can read their own dashboard progress snapshot"
  on public.dashboard_progress_snapshots for select
  using (auth.uid() = user_id);

-- These indexes cover the refresh queries and also improve legacy fallback reads.
create index if not exists unit_sessions_user_id_created_at_idx
  on public.unit_sessions (user_id, created_at desc);
create index if not exists unit_progress_steps_unit_id_status_idx
  on public.unit_progress_steps (unit_id, status);
create index if not exists image_assets_user_id_entity_type_idx
  on public.image_assets (user_id, entity_type);
create index if not exists user_paint_ownership_user_id_owned_idx
  on public.user_paint_ownership (user_id, is_owned);
create index if not exists paints_user_id_idx on public.paints (user_id);
create index if not exists recipes_user_id_public_idx
  on public.recipes (user_id, is_public);
create index if not exists contest_nominations_owner_status_idx
  on public.contest_nominations (owner_user_id, status);
create index if not exists contest_ballots_voter_status_idx
  on public.contest_ballots (voter_user_id, status);
create index if not exists unit_stage_paints_user_id_idx
  on public.unit_stage_paints (user_id);
create index if not exists saved_recipes_recipe_user_idx
  on public.saved_recipes (recipe_id, user_id);
create index if not exists contest_results_nomination_rank_idx
  on public.contest_results (nomination_id, final_rank);

create or replace function public.refresh_dashboard_progress_snapshot(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metrics jsonb;
  v_metadata jsonb;
  v_painting_days text[];
begin
  if p_user_id is null then return; end if;

  with
  user_units as (
    select id, status, coalesce(model_count, 1) as model_count, created_at
    from public.units where user_id = p_user_id
  ),
  user_sessions as (
    select created_at, coalesce(started_at, created_at) as session_at,
      coalesce(duration_seconds, 0)::integer as duration_seconds
    from public.unit_sessions where user_id = p_user_id
  ),
  session_summary as (
    select count(*) filter (where duration_seconds > 0)::integer as completed_count,
      coalesce(sum(duration_seconds), 0)::integer as total_seconds,
      coalesce(round(avg(nullif(duration_seconds, 0)))::integer, 0) as average_seconds,
      coalesce(max(duration_seconds), 0)::integer as longest_seconds,
      min(session_at) filter (where session_at is not null) as first_at,
      max(session_at) filter (where session_at is not null) as last_at
    from user_sessions
  ),
  painting_days as (
    select coalesce(array_agg(day_key order by day_key), '{}'::text[]) as days
    from (
      select distinct timezone('Asia/Jerusalem', created_at)::date::text as day_key
      from user_sessions where created_at is not null and duration_seconds >= 60
    ) d
  ),
  owned_paints as (
    select count(*) filter (where o.is_owned)::integer as owned_count,
      count(*) filter (where o.is_wishlist)::integer as wishlist_count,
      coalesce(sum(case when o.is_owned then greatest(o.units_owned, 1) else 0 end), 0)::integer as owned_units,
      count(distinct pc.brand) filter (where o.is_owned and pc.brand is not null)::integer as owned_brands
    from public.user_paint_ownership o
    left join public.paint_catalog pc on pc.id = o.paint_catalog_id
    where o.user_id = p_user_id
  ),
  most_used_paint as (
    select coalesce((
      select case when pc.brand is null then pc.name else pc.brand || ' ' || pc.name end
      from public.unit_stage_paints usp
      join public.paint_catalog pc on pc.id = usp.paint_catalog_id
      where usp.user_id = p_user_id and pc.name is not null
      group by pc.id, pc.brand, pc.name order by count(*) desc, pc.name limit 1
    ), '-') as label
  ),
  session_buckets as (
    select case
      when extract(hour from timezone('Asia/Jerusalem', session_at)) between 5 and 11 then 'morning'
      when extract(hour from timezone('Asia/Jerusalem', session_at)) between 12 and 13 then 'noon'
      when extract(hour from timezone('Asia/Jerusalem', session_at)) between 14 and 16 then 'afternoon'
      when extract(hour from timezone('Asia/Jerusalem', session_at)) between 17 and 21 then 'evening'
      else 'late-night' end as bucket, count(*)::integer as count
    from user_sessions where session_at is not null and duration_seconds > 0 group by 1
  ),
  paint_bucket_json as (
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'label', b.label, 'color', b.color,
      'count', coalesce(sb.count, 0),
      'percent', case when ss.completed_count > 0 then round(coalesce(sb.count, 0) * 100.0 / ss.completed_count)::integer else 0 end
    ) order by b.ordinal) as value
    from (values
      ('morning','Morning','#b96d3f',1), ('noon','Noon','#c99a55',2),
      ('afternoon','Afternoon','#8f7a45',3), ('evening','Evening','#526d72',4),
      ('late-night','Late-night','#39445e',5)
    ) b(id,label,color,ordinal)
    left join session_buckets sb on sb.bucket = b.id cross join session_summary ss
  )
  select jsonb_build_object(
      'units_created_total', (select count(*) from user_units),
      'units_completed_total', (select count(*) from user_units where status = 'complete'),
      'models_completed_total', (select coalesce(sum(greatest(model_count, 1)), 0) from user_units where status = 'complete'),
      'painting_sessions_total', ss.completed_count,
      'painting_minutes_total', floor(ss.total_seconds / 60.0)::integer,
      'progress_marks_total', (select count(*) from public.unit_progress_steps ups join user_units u on u.id = ups.unit_id where ups.status = 'done'),
      'progress_photos_total', (select count(*) from public.image_assets where user_id = p_user_id and entity_type = 'unit'),
      'paints_catalogued_total', op.owned_count + (select count(*) from public.paints where user_id = p_user_id),
      'guides_created_total', (select count(*) from public.recipes where user_id = p_user_id),
      'guides_published_total', (select count(*) from public.recipes where user_id = p_user_id and is_public),
      'unique_paints_used_in_progress_total', (select count(distinct coalesce(paint_catalog_id::text, custom_paint_id::text)) from public.unit_stage_paints where user_id = p_user_id),
      'contest_participations_total', (select count(*) from public.contest_nominations where owner_user_id = p_user_id and status in ('pending','approved')),
      'contest_votes_total', (select count(*) from public.contest_ballots where voter_user_id = p_user_id and status = 'submitted'),
      'guide_saves_received_total', (select count(*) from public.saved_recipes sr join public.recipes r on r.id = sr.recipe_id where r.user_id = p_user_id and sr.user_id <> p_user_id),
      'contest_wins_total', (select count(*) from public.contest_results cr join public.contest_nominations cn on cn.id = cr.nomination_id where cn.owner_user_id = p_user_id and cr.final_rank = 1)
    ), pd.days,
    jsonb_build_object(
      'total_units', (select count(*) from user_units),
      'recent_units', (select count(*) from user_units where created_at >= now() - interval '30 days'),
      'owned_colors', op.owned_count, 'wishlisted_paints', op.wishlist_count,
      'owned_paint_brands', op.owned_brands, 'owned_paint_units', op.owned_units,
      'total_logged_seconds', ss.total_seconds, 'average_session_seconds', ss.average_seconds,
      'longest_session_seconds', ss.longest_seconds, 'painting_sessions_count', ss.completed_count,
      'active_painting_days', cardinality(pd.days),
      'completed_units', (select count(*) from user_units where status = 'complete'),
      'models_completed', (select coalesce(sum(greatest(model_count, 1)), 0) from user_units where status = 'complete'),
      'most_used_paint', mup.label, 'painting_time_buckets', pbj.value,
      'last_session_at', ss.last_at,
      'average_sessions_per_week', case when ss.completed_count = 0 then 0 else round(ss.completed_count / greatest(extract(epoch from (ss.last_at - ss.first_at)) / 604800.0, 1), 2) end
    )
  into v_metrics, v_painting_days, v_metadata
  from session_summary ss cross join painting_days pd cross join owned_paints op
    cross join most_used_paint mup cross join paint_bucket_json pbj;

  insert into public.dashboard_progress_snapshots(user_id, achievement_metrics, painting_days, metadata, updated_at)
  values (p_user_id, coalesce(v_metrics, '{}'::jsonb), coalesce(v_painting_days, '{}'::text[]), coalesce(v_metadata, '{}'::jsonb), now())
  on conflict (user_id) do update set achievement_metrics = excluded.achievement_metrics,
    painting_days = excluded.painting_days, metadata = excluded.metadata, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_dashboard_progress_snapshot_direct()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_user uuid; new_user uuid;
begin
  if tg_op <> 'INSERT' then old_user := nullif(to_jsonb(old)->>tg_argv[0], '')::uuid; end if;
  if tg_op <> 'DELETE' then new_user := nullif(to_jsonb(new)->>tg_argv[0], '')::uuid; end if;
  if old_user is not null then perform public.refresh_dashboard_progress_snapshot(old_user); end if;
  if new_user is not null and new_user is distinct from old_user then perform public.refresh_dashboard_progress_snapshot(new_user); end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_dashboard_progress_snapshot_indirect()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_user uuid; new_user uuid; old_id uuid; new_id uuid;
begin
  if tg_table_name = 'unit_progress_steps' then
    if tg_op <> 'INSERT' then old_id := nullif(to_jsonb(old)->>'unit_id','')::uuid; end if;
    if tg_op <> 'DELETE' then new_id := nullif(to_jsonb(new)->>'unit_id','')::uuid; end if;
    select user_id into old_user from public.units where id = old_id;
    select user_id into new_user from public.units where id = new_id;
  elsif tg_table_name = 'saved_recipes' then
    if tg_op <> 'INSERT' then old_id := nullif(to_jsonb(old)->>'recipe_id','')::uuid; end if;
    if tg_op <> 'DELETE' then new_id := nullif(to_jsonb(new)->>'recipe_id','')::uuid; end if;
    select user_id into old_user from public.recipes where id = old_id;
    select user_id into new_user from public.recipes where id = new_id;
  else
    if tg_op <> 'INSERT' then old_id := nullif(to_jsonb(old)->>'nomination_id','')::uuid; end if;
    if tg_op <> 'DELETE' then new_id := nullif(to_jsonb(new)->>'nomination_id','')::uuid; end if;
    select owner_user_id into old_user from public.contest_nominations where id = old_id;
    select owner_user_id into new_user from public.contest_nominations where id = new_id;
  end if;
  if old_user is not null then perform public.refresh_dashboard_progress_snapshot(old_user); end if;
  if new_user is not null and new_user is distinct from old_user then perform public.refresh_dashboard_progress_snapshot(new_user); end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.refresh_dashboard_progress_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.refresh_dashboard_progress_snapshot(uuid) to service_role;
revoke all on function public.refresh_dashboard_progress_snapshot_direct() from public, anon, authenticated;
revoke all on function public.refresh_dashboard_progress_snapshot_indirect() from public, anon, authenticated;

do $$ declare item record; begin
  for item in select * from (values
    ('units','user_id'), ('unit_sessions','user_id'), ('image_assets','user_id'),
    ('user_paint_ownership','user_id'), ('paints','user_id'), ('recipes','user_id'),
    ('contest_nominations','owner_user_id'), ('contest_ballots','voter_user_id'),
    ('unit_stage_paints','user_id')
  ) v(table_name,user_column) loop
    execute format('drop trigger if exists refresh_dashboard_progress_snapshot on public.%I', item.table_name);
    execute format('create trigger refresh_dashboard_progress_snapshot after insert or update or delete on public.%I for each row execute function public.refresh_dashboard_progress_snapshot_direct(%L)', item.table_name, item.user_column);
  end loop;
end $$;

drop trigger if exists refresh_dashboard_progress_snapshot on public.unit_progress_steps;
create trigger refresh_dashboard_progress_snapshot after insert or update or delete on public.unit_progress_steps
for each row execute function public.refresh_dashboard_progress_snapshot_indirect();
drop trigger if exists refresh_dashboard_progress_snapshot on public.saved_recipes;
create trigger refresh_dashboard_progress_snapshot after insert or update or delete on public.saved_recipes
for each row execute function public.refresh_dashboard_progress_snapshot_indirect();
drop trigger if exists refresh_dashboard_progress_snapshot on public.contest_results;
create trigger refresh_dashboard_progress_snapshot after insert or update or delete on public.contest_results
for each row execute function public.refresh_dashboard_progress_snapshot_indirect();

select public.refresh_dashboard_progress_snapshot(id) from auth.users;

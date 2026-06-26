create table if not exists public.dashboard_unit_feed (
  unit_id uuid primary key references public.units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.unit_status not null,
  is_featured boolean not null default false,
  name text not null,
  deadline timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary_image_url text,
  last_session_at timestamptz,
  progress_percent integer not null default 0,
  parent_project_names text[] not null default '{}'
);

create index if not exists dashboard_unit_feed_user_id_status_idx
on public.dashboard_unit_feed (user_id, status);

create index if not exists dashboard_unit_feed_user_id_featured_idx
on public.dashboard_unit_feed (user_id, is_featured, updated_at desc);

create index if not exists dashboard_unit_feed_user_id_updated_at_idx
on public.dashboard_unit_feed (user_id, updated_at desc);

alter table public.dashboard_unit_feed enable row level security;

drop policy if exists "Users can read their own dashboard unit feed"
  on public.dashboard_unit_feed;

create policy "Users can read their own dashboard unit feed"
  on public.dashboard_unit_feed
  for select
  using (auth.uid() = user_id);

create or replace function public.refresh_dashboard_unit_feed(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select u.user_id
  into v_user_id
  from public.units u
  where u.id = p_unit_id;

  if v_user_id is null then
    delete from public.dashboard_unit_feed
    where unit_id = p_unit_id;
    return;
  end if;

  insert into public.dashboard_unit_feed (
    unit_id,
    user_id,
    status,
    is_featured,
    name,
    deadline,
    created_at,
    updated_at,
    primary_image_url,
    last_session_at,
    progress_percent,
    parent_project_names
  )
  with unit_row as (
    select
      u.id as unit_id,
      u.user_id,
      u.status,
      u.is_featured,
      u.name,
      u.deadline,
      u.created_at,
      u.updated_at
    from public.units u
    where u.id = p_unit_id
  ),
  featured_image as (
    select ia.image_url
    from public.image_assets ia
    where ia.entity_type = 'unit'
      and ia.entity_id = p_unit_id
      and ia.is_featured = true
    order by ia.created_at desc
    limit 1
  ),
  session_summary as (
    select max(us.started_at) as last_session_at
    from public.unit_sessions us
    where us.unit_id = p_unit_id
  ),
  progress_flags as (
    select
      stage_key,
      bool_or(is_done) as is_done
    from (
      select
        ups.step_key as stage_key,
        ups.status = 'done' as is_done
      from public.unit_progress_steps ups
      where ups.unit_id = p_unit_id

      union all

      select
        usp.stage_key,
        usp.is_done = true as is_done
      from public.unit_stage_progress usp
      where usp.unit_id = p_unit_id
        and usp.stage_key is not null
    ) progress_rows
    where stage_key is not null
    group by stage_key
  ),
  progress_summary as (
    select
      case
        when exists (
          select 1
          from unit_row
          where status = 'complete'
        ) then 100
        when exists (
          select 1
          from progress_flags
          where stage_key = 'done'
            and is_done = true
        ) then 100
        else (
          select count(*)::integer * 20
          from progress_flags
          where stage_key in (
            'assembled',
            'primed',
            'initial_paints',
            'fine_details',
            'base_rim'
          )
            and is_done = true
        )
      end as progress_percent
  ),
  project_names as (
    select coalesce(
      array_agg(
        coalesce(p.name, 'Untitled project')
        order by up.created_at asc, p.name asc
      ),
      '{}'::text[]
    ) as parent_project_names
    from public.unit_projects up
    left join public.projects p
      on p.id = up.project_id
    where up.unit_id = p_unit_id
      and up.user_id = v_user_id
  )
  select
    unit_row.unit_id,
    unit_row.user_id,
    unit_row.status,
    unit_row.is_featured,
    unit_row.name,
    unit_row.deadline,
    unit_row.created_at,
    unit_row.updated_at,
    (select image_url from featured_image),
    (select last_session_at from session_summary),
    coalesce((select progress_percent from progress_summary), 0),
    coalesce((select parent_project_names from project_names), '{}'::text[])
  from unit_row
  on conflict (unit_id) do update
  set
    user_id = excluded.user_id,
    status = excluded.status,
    is_featured = excluded.is_featured,
    name = excluded.name,
    deadline = excluded.deadline,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    primary_image_url = excluded.primary_image_url,
    last_session_at = excluded.last_session_at,
    progress_percent = excluded.progress_percent,
    parent_project_names = excluded.parent_project_names;
end;
$$;

create or replace function public.refresh_dashboard_unit_feed_from_units()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_dashboard_unit_feed(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_dashboard_unit_feed_from_related_unit_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_dashboard_unit_feed(coalesce(new.unit_id, old.unit_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_dashboard_unit_feed_from_image_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE'
    and new.entity_type = 'unit'
    and new.entity_id is not null then
    perform public.refresh_dashboard_unit_feed(new.entity_id);
  end if;

  if tg_op <> 'INSERT'
    and old.entity_type = 'unit'
    and old.entity_id is not null
    and (
      tg_op = 'DELETE'
      or new.entity_id is distinct from old.entity_id
      or new.entity_type is distinct from old.entity_type
    ) then
    perform public.refresh_dashboard_unit_feed(old.entity_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_dashboard_unit_feed_from_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := coalesce(new.id, old.id);
begin
  perform public.refresh_dashboard_unit_feed(up.unit_id)
  from public.unit_projects up
  where up.project_id = v_project_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_dashboard_unit_feed_on_units
  on public.units;
create trigger refresh_dashboard_unit_feed_on_units
after insert or update or delete on public.units
for each row execute function public.refresh_dashboard_unit_feed_from_units();

drop trigger if exists refresh_dashboard_unit_feed_on_unit_progress_steps
  on public.unit_progress_steps;
create trigger refresh_dashboard_unit_feed_on_unit_progress_steps
after insert or update or delete on public.unit_progress_steps
for each row execute function public.refresh_dashboard_unit_feed_from_related_unit_id();

drop trigger if exists refresh_dashboard_unit_feed_on_unit_stage_progress
  on public.unit_stage_progress;
create trigger refresh_dashboard_unit_feed_on_unit_stage_progress
after insert or update or delete on public.unit_stage_progress
for each row execute function public.refresh_dashboard_unit_feed_from_related_unit_id();

drop trigger if exists refresh_dashboard_unit_feed_on_unit_sessions
  on public.unit_sessions;
create trigger refresh_dashboard_unit_feed_on_unit_sessions
after insert or update or delete on public.unit_sessions
for each row execute function public.refresh_dashboard_unit_feed_from_related_unit_id();

drop trigger if exists refresh_dashboard_unit_feed_on_unit_projects
  on public.unit_projects;
create trigger refresh_dashboard_unit_feed_on_unit_projects
after insert or update or delete on public.unit_projects
for each row execute function public.refresh_dashboard_unit_feed_from_related_unit_id();

drop trigger if exists refresh_dashboard_unit_feed_on_image_assets
  on public.image_assets;
create trigger refresh_dashboard_unit_feed_on_image_assets
after insert or update or delete on public.image_assets
for each row execute function public.refresh_dashboard_unit_feed_from_image_asset();

drop trigger if exists refresh_dashboard_unit_feed_on_projects
  on public.projects;
create trigger refresh_dashboard_unit_feed_on_projects
after update or delete on public.projects
for each row execute function public.refresh_dashboard_unit_feed_from_project();

select public.refresh_dashboard_unit_feed(u.id)
from public.units u
where u.user_id is not null;

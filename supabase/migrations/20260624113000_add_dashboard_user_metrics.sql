create table if not exists public.dashboard_user_metrics (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_units integer not null default 0,
  recent_units integer not null default 0,
  owned_colors integer not null default 0,
  total_logged_seconds integer not null default 0,
  average_session_seconds integer not null default 0,
  average_sessions_per_week numeric(8,2) not null default 0,
  last_session_at timestamptz,
  paint_streak_days integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_user_metrics enable row level security;

drop policy if exists "Users can read their own dashboard metrics"
  on public.dashboard_user_metrics;

create policy "Users can read their own dashboard metrics"
  on public.dashboard_user_metrics
  for select
  using (auth.uid() = user_id);

create or replace function public.refresh_dashboard_user_metrics(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := timezone('Asia/Jerusalem', now())::date;
begin
  insert into public.dashboard_user_metrics (
    user_id,
    total_units,
    recent_units,
    owned_colors,
    total_logged_seconds,
    average_session_seconds,
    average_sessions_per_week,
    last_session_at,
    paint_streak_days,
    updated_at
  )
  with unit_counts as (
    select
      count(*)::integer as total_units,
      count(*) filter (
        where created_at >= now() - interval '30 days'
      )::integer as recent_units
    from public.units
    where user_id = p_user_id
  ),
  owned_colors as (
    select count(*)::integer as owned_colors
    from public.user_paint_ownership
    where user_id = p_user_id
      and is_owned = true
  ),
  session_rows as (
    select
      created_at,
      coalesce(duration_seconds, 0)::integer as duration_seconds
    from public.unit_sessions
    where user_id = p_user_id
  ),
  session_summary as (
    select
      coalesce(sum(duration_seconds), 0)::integer as total_logged_seconds,
      coalesce(
        round(avg(nullif(duration_seconds, 0)))::integer,
        0
      ) as average_session_seconds,
      max(created_at) as last_session_at,
      min(created_at) filter (where created_at is not null) as oldest_session_at,
      max(created_at) filter (where created_at is not null) as newest_session_at,
      count(*) filter (where created_at is not null)::numeric as dated_session_count
    from session_rows
  ),
  qualifying_days as (
    select distinct timezone('Asia/Jerusalem', created_at)::date as session_day
    from session_rows
    where created_at is not null
      and duration_seconds >= 60
  ),
  streak_rows as (
    select
      session_day,
      row_number() over (order by session_day desc) as row_num
    from qualifying_days
  ),
  streak_summary as (
    select count(*)::integer as paint_streak_days
    from streak_rows
    where session_day = (v_today - ((row_num - 1)::integer))
  ),
  weekly_summary as (
    select
      case
        when dated_session_count = 0 then 0::numeric
        when oldest_session_at is null or newest_session_at is null then 0::numeric
        else round(
          dated_session_count / greatest(
            extract(epoch from (newest_session_at - oldest_session_at)) / 604800.0,
            1
          ),
          2
        )
      end as average_sessions_per_week
    from session_summary
  )
  select
    p_user_id,
    coalesce(unit_counts.total_units, 0),
    coalesce(unit_counts.recent_units, 0),
    coalesce(owned_colors.owned_colors, 0),
    coalesce(session_summary.total_logged_seconds, 0),
    coalesce(session_summary.average_session_seconds, 0),
    coalesce(weekly_summary.average_sessions_per_week, 0),
    session_summary.last_session_at,
    coalesce(streak_summary.paint_streak_days, 0),
    now()
  from unit_counts
  cross join owned_colors
  cross join session_summary
  cross join weekly_summary
  cross join streak_summary
  on conflict (user_id) do update
  set
    total_units = excluded.total_units,
    recent_units = excluded.recent_units,
    owned_colors = excluded.owned_colors,
    total_logged_seconds = excluded.total_logged_seconds,
    average_session_seconds = excluded.average_session_seconds,
    average_sessions_per_week = excluded.average_sessions_per_week,
    last_session_at = excluded.last_session_at,
    paint_streak_days = excluded.paint_streak_days,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_dashboard_user_metrics_from_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' and old.user_id is not null then
    perform public.refresh_dashboard_user_metrics(old.user_id);
  end if;

  if tg_op <> 'DELETE' and new.user_id is not null then
    perform public.refresh_dashboard_user_metrics(new.user_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_dashboard_user_metrics_on_units
  on public.units;
create trigger refresh_dashboard_user_metrics_on_units
after insert or update or delete on public.units
for each row execute function public.refresh_dashboard_user_metrics_from_row();

drop trigger if exists refresh_dashboard_user_metrics_on_unit_sessions
  on public.unit_sessions;
create trigger refresh_dashboard_user_metrics_on_unit_sessions
after insert or update or delete on public.unit_sessions
for each row execute function public.refresh_dashboard_user_metrics_from_row();

drop trigger if exists refresh_dashboard_user_metrics_on_user_paint_ownership
  on public.user_paint_ownership;
create trigger refresh_dashboard_user_metrics_on_user_paint_ownership
after insert or update or delete on public.user_paint_ownership
for each row execute function public.refresh_dashboard_user_metrics_from_row();

with dashboard_metric_users as (
  select distinct user_id
  from public.units
  where user_id is not null
  union
  select distinct user_id
  from public.unit_sessions
  where user_id is not null
  union
  select distinct user_id
  from public.user_paint_ownership
  where user_id is not null
)
select public.refresh_dashboard_user_metrics(user_id)
from dashboard_metric_users;

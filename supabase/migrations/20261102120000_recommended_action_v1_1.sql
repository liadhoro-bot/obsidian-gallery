-- Recommended Action V1.1 (docs/recommended-action/v1.1-audit-and-plan.md).
-- Additive only: nothing existing is renamed, rewritten or dropped except the
-- two check constraints that are widened in place.
--
-- 1. unit_progress_steps.updated_at: a stage change can finally be dated.
--    Earlier changes stay undated (null) and the engine treats them as unknown.
-- 2. recommended_action_activity(): one bounded read of the user's meaningful
--    activity (sessions, stage changes, photos, palettes, guide edits...).
--    SECURITY INVOKER, so RLS still decides what it can see.
-- 3. Events, instances: new event types, dismiss reasons, 'invalidated'.
-- 4. recommended_action_traces: why each ranking won, owner-only.

-- 1. Stage change timestamps ---------------------------------------------

alter table public.unit_progress_steps
  add column if not exists updated_at timestamptz;

create or replace function public.touch_unit_progress_step_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only a real status change counts; saving the same status is a no-op.
  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      new.updated_at := now();
    end if;
  elsif new.status is distinct from old.status then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists touch_unit_progress_step_updated_at on public.unit_progress_steps;
create trigger touch_unit_progress_step_updated_at
before insert or update on public.unit_progress_steps
for each row execute function public.touch_unit_progress_step_updated_at();

-- 2. Activity read --------------------------------------------------------

-- Per-user lookups the activity function filters on. "if not exists" keeps
-- reruns safe; these names are new, so nothing existing is replaced.
create index if not exists ra_unit_sessions_user_ended_idx
  on public.unit_sessions (user_id, ended_at desc);
create index if not exists ra_image_assets_user_entity_created_idx
  on public.image_assets (user_id, entity_type, created_at desc);
create index if not exists ra_unit_projects_user_idx
  on public.unit_projects (user_id, project_id);
create index if not exists ra_user_paint_ownership_user_created_idx
  on public.user_paint_ownership (user_id, created_at desc);
create index if not exists ra_unit_stage_paints_user_idx
  on public.unit_stage_paints (user_id, created_at desc);
create index if not exists ra_unit_stage_recipes_user_idx
  on public.unit_stage_recipes (user_id, created_at desc);
create index if not exists ra_recipe_steps_user_updated_idx
  on public.recipe_steps (user_id, updated_at desc);
create index if not exists ra_saved_recipes_user_created_idx
  on public.saved_recipes (user_id, created_at desc);
create index if not exists ra_unit_progress_steps_unit_updated_idx
  on public.unit_progress_steps (unit_id, updated_at desc)
  where updated_at is not null;

-- Meaningful actions only: no page views, no project creation on its own.
-- A painting session counts once it ran for 5 minutes. Bulk writes (a paint
-- set marking 40 paints owned) collapse to one action per kind per minute.
create or replace function public.recommended_action_activity(
  p_user_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'recommended_action_activity: no user' using errcode = '42501';
  end if;

  -- A signed-in user may only ask about themselves. The service role (review
  -- script) has no auth.uid() and may name a user.
  if auth.uid() is not null and v_user <> auth.uid() then
    raise exception 'recommended_action_activity: not allowed' using errcode = '42501';
  end if;

  with acts as (
    select coalesce(s.ended_at, s.started_at) as at, 'painting'::text as family, s.unit_id, 'session'::text as kind
    from public.unit_sessions s
    where s.user_id = v_user
      and s.ended_at is not null
      and coalesce(s.duration_seconds, extract(epoch from (s.ended_at - s.started_at))) >= 300
    union all
    select p.updated_at, 'painting', p.unit_id, 'stage'
    from public.unit_progress_steps p
    join public.units u on u.id = p.unit_id
    where u.user_id = v_user and p.updated_at is not null and p.status <> 'pending'
    union all
    select sp.updated_at, 'painting', sp.unit_id, 'stage'
    from public.unit_stage_progress sp
    join public.units u on u.id = sp.unit_id
    where u.user_id = v_user and sp.is_done and sp.updated_at is not null
    union all
    select i.created_at, 'painting', i.entity_id, 'photo'
    from public.image_assets i
    where i.user_id = v_user and i.entity_type = 'unit'
    union all
    select u.created_at, 'painting', u.id, 'unit'
    from public.units u
    where u.user_id = v_user
    union all
    select usp.created_at, 'paints', usp.unit_id, 'palette'
    from public.unit_stage_paints usp
    where usp.user_id = v_user
    union all
    select usr.created_at, 'discovery', usr.unit_id, 'guide_link'
    from public.unit_stage_recipes usr
    where usr.user_id = v_user
    union all
    select o.created_at, 'paints', null::uuid, 'owned_paint'
    from public.user_paint_ownership o
    where o.user_id = v_user and o.is_owned
    union all
    select sr.created_at, 'discovery', null::uuid, 'saved_guide'
    from public.saved_recipes sr
    where sr.user_id = v_user
    union all
    select g.created_at, 'guides', null::uuid, 'guide'
    from public.guides g
    where g.user_id = v_user and not g.is_auto
    union all
    select rs.updated_at, 'guides', null::uuid, 'guide_card'
    from public.recipe_steps rs
    where rs.user_id = v_user and rs.updated_at is not null
  ),
  dedup as (
    select distinct
      date_trunc('minute', at) as at,
      family,
      unit_id,
      kind
    from acts
    where at is not null and at <= p_now
  ),
  families as (
    select
      family,
      count(*) as lifetime,
      count(*) filter (where at > p_now - interval '30 days') as actions_30,
      count(distinct (at at time zone 'utc')::date) filter (where at > p_now - interval '30 days') as days_30,
      count(*) filter (where at > p_now - interval '7 days') as actions_7
    from dedup
    group by family
  ),
  unit_stats as (
    select
      unit_id,
      max(at) as last_at,
      count(*) filter (where kind = 'session' and at > p_now - interval '7 days') as sessions_7,
      count(*) filter (where kind = 'session' and at > p_now - interval '30 days') as sessions_30,
      count(*) filter (where kind = 'session') as sessions_total,
      max(at) filter (where kind = 'session') as last_session_at,
      max(at) filter (where kind = 'stage') as last_stage_at,
      max(at) filter (where kind = 'photo') as last_photo_at,
      count(*) filter (where at > p_now - interval '30 days') as actions_30,
      count(*) filter (where kind = 'palette') as palette_count,
      count(*) filter (where kind = 'guide_link') as guide_link_count
    from dedup
    where unit_id is not null
    group by unit_id
  ),
  -- Recently worked units plus the ten with the most sessions ever, so a
  -- lapsed painter's main unit is still known.
  picked_units as (
    select * from unit_stats where last_at > p_now - interval '30 days'
    union
    select * from (
      select * from unit_stats order by sessions_total desc, last_at desc limit 10
    ) top_units
  ),
  project_stats as (
    select
      up.project_id,
      greatest(max(up.created_at), max(us.last_at)) as last_child_at
    from public.unit_projects up
    left join unit_stats us on us.unit_id = up.unit_id
    where up.user_id = v_user
    group by up.project_id
  ),
  guide_recipes as (
    select g.id as guide_id, g.updated_at as guide_updated_at, g.primary_recipe_id as recipe_id
    from public.guides g
    where g.user_id = v_user and not g.is_auto
    union
    select g.id, g.updated_at, gd.recipe_id
    from public.guides g
    join public.guide_decks gd on gd.guide_id = g.id
    where g.user_id = v_user and not g.is_auto
  ),
  guide_stats as (
    select
      gr.guide_id,
      greatest(max(gr.guide_updated_at), max(rs.updated_at)) as last_edit_at,
      count(rs.id) as content_count
    from guide_recipes gr
    left join public.recipe_steps rs on rs.recipe_id = gr.recipe_id
    group by gr.guide_id
  )
  select jsonb_build_object(
    'first_at', (select min(at) from dedup),
    'last_at', (select max(at) from dedup),
    'days_lifetime', (select count(distinct (at at time zone 'utc')::date) from dedup),
    'actions_lifetime', (select count(*) from dedup),
    'days_30', (select count(distinct (at at time zone 'utc')::date) from dedup where at > p_now - interval '30 days'),
    'actions_30', (select count(*) from dedup where at > p_now - interval '30 days'),
    'actions_7', (select count(*) from dedup where at > p_now - interval '7 days'),
    'sessions_30', (select count(*) from dedup where kind = 'session' and at > p_now - interval '30 days'),
    'families', coalesce((
      select jsonb_object_agg(family, jsonb_build_object(
        'lifetime', lifetime, 'actions_30', actions_30, 'days_30', days_30, 'actions_7', actions_7
      ))
      from families
    ), '{}'::jsonb),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_id', unit_id, 'last_at', last_at,
        'sessions_7', sessions_7, 'sessions_30', sessions_30, 'sessions_total', sessions_total,
        'last_session_at', last_session_at, 'last_stage_at', last_stage_at, 'last_photo_at', last_photo_at,
        'actions_30', actions_30, 'palette_count', palette_count, 'guide_link_count', guide_link_count
      ) order by last_at desc)
      from (select * from picked_units order by last_at desc limit 80) limited_units
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('project_id', project_id, 'last_child_at', last_child_at))
      from (select * from project_stats order by last_child_at desc nulls last limit 200) limited_projects
    ), '[]'::jsonb),
    'guides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guide_id', guide_id, 'last_edit_at', last_edit_at, 'content_count', content_count
      ))
      from (select * from guide_stats order by last_edit_at desc nulls last limit 50) limited_guides
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.recommended_action_activity(uuid, timestamptz) from public, anon;
grant execute on function public.recommended_action_activity(uuid, timestamptz) to authenticated, service_role;

-- 3. Events and instances -------------------------------------------------

alter table public.recommended_action_events
  drop constraint if exists recommended_action_events_event_type_check;
alter table public.recommended_action_events
  add constraint recommended_action_events_event_type_check check (event_type in (
    'impression', 'primary_click', 'show_another', 'snooze', 'dismiss', 'dismiss_reason',
    'goal_completed', 'expired', 'invalidated', 'action_failed', 'evaluation_fault', 'no_candidate'
  ));

alter table public.recommended_action_instances
  drop constraint if exists recommended_action_instances_status_check;
alter table public.recommended_action_instances
  add constraint recommended_action_instances_status_check check (
    status in ('served', 'clicked', 'completed', 'dismissed', 'snoozed', 'expired', 'invalidated')
  );

alter table public.recommended_action_instances
  add column if not exists dismiss_reason text
    check (dismiss_reason in ('not_relevant', 'already_done', 'not_now', 'dont_use_feature')),
  add column if not exists ranking_revision text;

-- 4. Ranking traces ------------------------------------------------------

-- One row per user, ranking revision and 30-minute bucket: the served ranking
-- and the shadow one side by side. Rule ids, target ids and numbers only; no
-- names, notes or image URLs. Kept 90 days (scripts/recommended-action-report.mjs
-- --prune deletes older rows).
create table if not exists public.recommended_action_traces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  time_bucket bigint not null,
  ranking_revision text not null check (ranking_revision in ('v1', 'v1.1')),
  served boolean not null,
  ruleset_version text not null,
  lifecycle text,
  observed_intent text,
  data_confidence text,
  snapshot_coverage text,
  winner jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  rejections jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  shadow_agreement boolean,
  unique (user_id, ranking_revision, time_bucket)
);

create index if not exists recommended_action_traces_created_idx
  on public.recommended_action_traces (created_at desc);

alter table public.recommended_action_traces enable row level security;

drop policy if exists "recommended_action_traces_owner_select" on public.recommended_action_traces;
create policy "recommended_action_traces_owner_select"
on public.recommended_action_traces
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recommended_action_traces_owner_insert" on public.recommended_action_traces;
create policy "recommended_action_traces_owner_insert"
on public.recommended_action_traces
for insert
to authenticated
with check (user_id = auth.uid());

grant select, insert on public.recommended_action_traces to authenticated;

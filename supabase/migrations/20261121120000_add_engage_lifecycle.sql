-- ENGAGE: lifecycle state + context modifiers + reachability
-- (Lifecycle Engagement & Messaging Framework v1.1, sections 3, 4, 5.2, 6.3, 12).
--
-- What this adds
--   user_visits                      one row per user per UTC day they opened the app
--   user_lifecycle                   one derived row per user: state, modifiers,
--                                    reachability, cadence
--   user_lifecycle_transitions       append-only history of state changes
--   notification_permission_events   push opt-in funnel (soft prompt -> native -> granted)
--   engagement_messages              the message catalog (V1: eight messages), seeded
--                                    in 'review' status so nothing reaches users yet
--   engagement_deliveries            every shown / sent / clicked / dismissed message
--
-- Core Progress Actions (framework 3.1) are read from timestamps that already
-- exist in the hobby tables, so no trigger is added to units, sessions or
-- guides and their write paths are untouched.
--
-- Writes happen only through the SECURITY DEFINER functions below (each one
-- acts on auth.uid() only) or the service role. Users can read their own rows.

-- 1. Visits ------------------------------------------------------------------

create table if not exists public.user_visits (
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_date date not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  hits integer not null default 1,
  primary key (user_id, visit_date)
);

alter table public.user_visits enable row level security;

drop policy if exists "user_visits_owner_select" on public.user_visits;
create policy "user_visits_owner_select" on public.user_visits
  for select to authenticated using (user_id = auth.uid());

-- 2. Lifecycle record ---------------------------------------------------------

create table if not exists public.user_lifecycle (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Lifecycle state (mutually exclusive)
  lifecycle_state text not null default 'unactivated'
    check (lifecycle_state in ('unactivated', 'active', 'passive', 'at_risk', 'dormant')),
  previous_state text
    check (previous_state in ('unactivated', 'active', 'passive', 'at_risk', 'dormant')),
  state_entered_at timestamptz not null default now(),
  reactivated_until timestamptz,
  activated_at timestamptz,
  last_visit_at timestamptz,
  previous_visit_at timestamptz,
  last_core_progress_at timestamptz,
  visits_7d integer not null default 0,
  core_progress_actions_7d integer not null default 0,

  -- Context modifiers (additive)
  active_unit_count integer not null default 0,
  stale_active_unit_count integer not null default 0,
  focus_unit_id uuid,
  focus_unit_last_activity_at timestamptz,
  draft_guide_count integer not null default 0,
  assigned_guide_count integer not null default 0,
  saved_guides_unassigned_count integer not null default 0,
  latest_unassigned_saved_recipe_id uuid,
  deadline_within_72h boolean not null default false,
  deadline_unit_id uuid,
  scheduled_session_within_24h boolean not null default false,
  recent_social_reward_count integer not null default 0,
  social_reward_recipe_id uuid,
  upcoming_event_24h boolean not null default false,
  active_session_unit_id uuid,
  last_session_ended_at timestamptz,
  last_session_unit_id uuid,

  -- Reachability (framework 5.2 / 6.3)
  push_preference text not null default 'unknown'
    check (push_preference in ('on', 'off', 'unknown')),
  push_platform_permission text not null default 'unknown'
    check (push_platform_permission in ('granted', 'denied', 'prompt', 'unsupported', 'unknown')),
  push_subscription_active boolean not null default false,
  notification_soft_opt_in text not null default 'not_shown'
    check (notification_soft_opt_in in ('not_shown', 'shown', 'enabled', 'skipped', 'dismissed')),
  notification_soft_prompt_last_at timestamptz,
  notification_soft_prompt_source text,
  notification_native_prompt_last_at timestamptz,
  notification_permission_granted_at timestamptz,
  notification_permission_revoked_at timestamptz,
  notification_opt_in_cooldown_until timestamptz,
  email_status text not null default 'unknown'
    check (email_status in ('deliverable', 'unsubscribed', 'bounced', 'unknown')),
  -- No marketing consent is collected yet, so lifecycle email stays off.
  email_marketing_allowed boolean not null default false,
  transactional_email_allowed boolean not null default true,
  community_member_whatsapp boolean,
  community_member_facebook boolean,
  youtube_live_affinity text not null default 'unknown'
    check (youtube_live_affinity in ('attended', 'clicked', 'unknown')),

  -- Cadence / suppression (framework 8.3 / 9)
  last_push_at timestamptz,
  last_popup_at timestamptz,
  last_topper_dismissed_at timestamptz,
  -- { "<message family>": "<ISO time it was last shown or dismissed>" }
  message_family_last_at jsonb not null default '{}'::jsonb,
  -- { "<message family>": "<ISO time suppression ends>" }
  message_family_suppressed_until jsonb not null default '{}'::jsonb,

  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_lifecycle_state_idx on public.user_lifecycle (lifecycle_state);

alter table public.user_lifecycle enable row level security;

drop policy if exists "user_lifecycle_owner_select" on public.user_lifecycle;
create policy "user_lifecycle_owner_select" on public.user_lifecycle
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.user_lifecycle_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_state text,
  to_state text not null,
  reactivated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_lifecycle_transitions_user_idx
  on public.user_lifecycle_transitions (user_id, created_at desc);

alter table public.user_lifecycle_transitions enable row level security;

drop policy if exists "user_lifecycle_transitions_owner_select" on public.user_lifecycle_transitions;
create policy "user_lifecycle_transitions_owner_select" on public.user_lifecycle_transitions
  for select to authenticated using (user_id = auth.uid());

-- 3. Notification permission funnel -------------------------------------------

create table if not exists public.notification_permission_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in (
    'soft_prompt_shown', 'soft_prompt_enable', 'soft_prompt_skipped', 'soft_prompt_dismissed',
    'native_prompt_requested', 'permission_granted', 'permission_denied',
    'subscription_removed', 'permission_observed'
  )),
  source text not null check (char_length(source) between 1 and 60),
  permission text check (permission in ('granted', 'denied', 'prompt', 'unsupported', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists notification_permission_events_user_idx
  on public.notification_permission_events (user_id, created_at desc);

alter table public.notification_permission_events enable row level security;

drop policy if exists "notification_permission_events_owner_select" on public.notification_permission_events;
create policy "notification_permission_events_owner_select" on public.notification_permission_events
  for select to authenticated using (user_id = auth.uid());

-- 4. Message catalog -----------------------------------------------------------

create table if not exists public.engagement_messages (
  key text primary key check (key ~ '^[a-z0-9_]{3,60}$'),
  v1_number integer,
  value_pillar text not null check (value_pillar in ('productivity', 'inspiration', 'learning', 'community', 'reachability')),
  -- Suppression family: a dismissal mutes every message in the family.
  message_family text not null,
  surface text not null check (surface in ('push', 'popup', 'topper', 'email')),
  lifecycle_states text[] not null,
  priority integer not null check (priority between 1 and 7),
  title text not null,
  body text not null,
  cta_label text not null,
  -- Path template. Placeholders: {unit_id} {recipe_id} {guide_id}
  cta_path text not null check (cta_path like '/%'),
  eligibility text not null,
  hypothesis text,
  success_event text,
  -- draft: being written · review: ready for inspection, previews only ·
  -- live: shown / sent to eligible users · paused: off after being live
  status text not null default 'review' check (status in ('draft', 'review', 'live', 'paused')),
  updated_at timestamptz not null default now()
);

alter table public.engagement_messages enable row level security;

drop policy if exists "engagement_messages_read" on public.engagement_messages;
create policy "engagement_messages_read" on public.engagement_messages
  for select to authenticated using (true);

create table if not exists public.engagement_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_key text not null references public.engagement_messages (key) on update cascade,
  channel text not null check (channel in ('push', 'popup', 'topper', 'email')),
  status text not null check (status in ('shown', 'sent', 'clicked', 'dismissed', 'converted', 'failed')),
  lifecycle_state text,
  target_id uuid,
  is_preview boolean not null default false,
  -- One row per (user, dedup_key): the same impression isn't logged twice.
  dedup_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

create index if not exists engagement_deliveries_user_idx
  on public.engagement_deliveries (user_id, created_at desc);
create index if not exists engagement_deliveries_message_idx
  on public.engagement_deliveries (message_key, status, created_at desc);

alter table public.engagement_deliveries enable row level security;

drop policy if exists "engagement_deliveries_owner_select" on public.engagement_deliveries;
create policy "engagement_deliveries_owner_select" on public.engagement_deliveries
  for select to authenticated using (user_id = auth.uid());

-- Lookups the lifecycle computation filters on.
create index if not exists engage_unit_sessions_user_started_idx
  on public.unit_sessions (user_id, started_at desc);
create index if not exists engage_units_user_status_idx
  on public.units (user_id, status);
create index if not exists engage_guides_user_idx
  on public.guides (user_id, updated_at desc);
create index if not exists engage_projects_user_created_idx
  on public.projects (user_id, created_at desc);
create index if not exists engage_content_assignments_user_idx
  on public.content_assignments (user_id, created_at desc);
create index if not exists engage_step_completions_user_idx
  on public.unit_guide_step_completions (user_id, completed_at desc);
create index if not exists engage_recipe_likes_recipe_idx
  on public.recipe_likes (recipe_id, created_at desc);
create index if not exists engage_saved_recipes_recipe_idx
  on public.saved_recipes (recipe_id, created_at desc);

-- 5. Lifecycle computation -----------------------------------------------------

create or replace function public.engage_compute_lifecycle(
  p_user_id uuid default null,
  p_now timestamptz default now()
)
returns public.user_lifecycle
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_prev public.user_lifecycle;
  v_row public.user_lifecycle;
  v_state text;
  v_today date := (p_now at time zone 'utc')::date;
  v_activated_at timestamptz;
  v_last_core timestamptz;
  v_core_7d integer;
  v_last_visit timestamptz;
  v_prev_visit timestamptz;
  v_visits_7d integer;
  v_last_seen timestamptz;
  v_reactivated_until timestamptz;
  v_has_sub boolean;
  v_email_confirmed boolean;
begin
  if v_user is null then
    raise exception 'engage_compute_lifecycle: no user' using errcode = '42501';
  end if;
  -- A signed-in user may only compute themselves. The service role (cron,
  -- admin) has no auth.uid() and may name anyone.
  if auth.uid() is not null and v_user <> auth.uid() then
    raise exception 'engage_compute_lifecycle: not allowed' using errcode = '42501';
  end if;

  select * into v_prev from public.user_lifecycle where user_id = v_user;

  -- Core Progress Actions (framework 3.1). Bulk writes collapse to one
  -- action per kind per minute; paint collection counts only as 3+ paints
  -- in one day.
  with acts as (
    select s.started_at as at, 'session_start'::text as kind
      from public.unit_sessions s where s.user_id = v_user
    union all
    select s.ended_at, 'session_end'
      from public.unit_sessions s where s.user_id = v_user and s.ended_at is not null
    union all
    select u.created_at, 'unit_create' from public.units u where u.user_id = v_user
    union all
    select p.updated_at, 'unit_progress'
      from public.unit_progress_steps p join public.units u on u.id = p.unit_id
      where u.user_id = v_user and p.updated_at is not null and p.status <> 'pending'
    union all
    select i.created_at, 'unit_photo'
      from public.image_assets i where i.user_id = v_user and i.entity_type = 'unit'
    union all
    select g.created_at, 'guide_create'
      from public.guides g where g.user_id = v_user and not g.is_auto
    union all
    select rs.updated_at, 'guide_edit'
      from public.recipe_steps rs where rs.user_id = v_user and rs.updated_at is not null
    union all
    select ca.created_at, 'guide_assign'
      from public.content_assignments ca where ca.user_id = v_user
    union all
    select usr.created_at, 'guide_assign'
      from public.unit_stage_recipes usr where usr.user_id = v_user
    union all
    select c.completed_at, 'guide_step'
      from public.unit_guide_step_completions c where c.user_id = v_user
    union all
    select pr.created_at, 'project_create' from public.projects pr where pr.user_id = v_user
    union all
    select up.created_at, 'project_add_unit' from public.unit_projects up where up.user_id = v_user
    union all
    select min(o.created_at), 'paint_collection'
      from public.user_paint_ownership o
      where o.user_id = v_user and o.is_owned
      group by (o.created_at at time zone 'utc')::date
      having count(*) >= 3
  ),
  dedup as (
    select distinct date_trunc('minute', at) as at, kind
    from acts where at is not null and at <= p_now
  )
  select min(at), max(at), count(*) filter (where at > p_now - interval '7 days')
    into v_activated_at, v_last_core, v_core_7d
  from dedup;

  -- Visits. Recorded visits only exist from this release on, so a day with a
  -- Core Progress Action also counts as a visit, and the last sign-in is a
  -- floor for older accounts.
  select max(v.last_at) into v_last_visit from public.user_visits v where v.user_id = v_user;
  select max(v.last_at) into v_prev_visit
    from public.user_visits v where v.user_id = v_user and v.visit_date < v_today;

  select greatest(v_last_visit, v_last_core, au.last_sign_in_at), au.email_confirmed_at is not null
    into v_last_visit, v_email_confirmed
  from auth.users au where au.id = v_user;

  select count(*) into v_visits_7d from (
    select v.visit_date as d from public.user_visits v
      where v.user_id = v_user and v.visit_date > v_today - 7
    union
    select (s.started_at at time zone 'utc')::date from public.unit_sessions s
      where s.user_id = v_user and s.started_at > p_now - interval '7 days'
  ) days;

  v_last_seen := greatest(v_last_visit, v_last_core);

  -- State (framework 3). Rules are checked in order.
  if v_activated_at is null then
    v_state := 'unactivated';
  elsif v_core_7d >= 1 then
    v_state := 'active';
  elsif v_visits_7d >= 2 then
    v_state := 'passive';
  elsif v_last_seen is not null and v_last_seen > p_now - interval '22 days' then
    -- 0 progress, 0-1 visits in 7 days. Includes a single visit inside the
    -- last week: the habit is breaking even though they glanced in.
    v_state := 'at_risk';
  else
    v_state := 'dormant';
  end if;

  -- Reactivated flag (framework 3.2): At Risk / Dormant -> Active.
  v_reactivated_until := v_prev.reactivated_until;
  if v_state = 'active' and v_prev.lifecycle_state in ('at_risk', 'dormant') then
    v_reactivated_until := p_now + interval '7 days';
  end if;
  if v_reactivated_until is not null and v_reactivated_until <= p_now then
    v_reactivated_until := null;
  end if;

  select exists (select 1 from public.push_subscriptions ps where ps.user_id = v_user) into v_has_sub;

  insert into public.user_lifecycle as ul (
    user_id, lifecycle_state, previous_state, state_entered_at, reactivated_until,
    activated_at, last_visit_at, previous_visit_at, last_core_progress_at,
    visits_7d, core_progress_actions_7d,
    push_subscription_active, push_preference, push_platform_permission,
    email_status, computed_at
  ) values (
    v_user, v_state, v_prev.lifecycle_state,
    case when v_prev.lifecycle_state is distinct from v_state then p_now else coalesce(v_prev.state_entered_at, p_now) end,
    v_reactivated_until, v_activated_at, v_last_visit, v_prev_visit, v_last_core,
    coalesce(v_visits_7d, 0), coalesce(v_core_7d, 0),
    v_has_sub,
    case when v_has_sub then 'on' when v_prev.push_preference = 'on' then 'off' else coalesce(v_prev.push_preference, 'unknown') end,
    case when v_has_sub then 'granted' else coalesce(v_prev.push_platform_permission, 'unknown') end,
    case
      when v_prev.email_status in ('unsubscribed', 'bounced') then v_prev.email_status
      when v_email_confirmed then 'deliverable'
      else 'unknown'
    end,
    p_now
  )
  on conflict (user_id) do update set
    lifecycle_state = excluded.lifecycle_state,
    previous_state = case
      when ul.lifecycle_state is distinct from excluded.lifecycle_state then ul.lifecycle_state
      else ul.previous_state end,
    state_entered_at = excluded.state_entered_at,
    reactivated_until = excluded.reactivated_until,
    activated_at = excluded.activated_at,
    last_visit_at = excluded.last_visit_at,
    previous_visit_at = excluded.previous_visit_at,
    last_core_progress_at = excluded.last_core_progress_at,
    visits_7d = excluded.visits_7d,
    core_progress_actions_7d = excluded.core_progress_actions_7d,
    push_subscription_active = excluded.push_subscription_active,
    push_preference = excluded.push_preference,
    push_platform_permission = excluded.push_platform_permission,
    notification_permission_revoked_at = case
      when ul.push_subscription_active and not excluded.push_subscription_active then p_now
      else ul.notification_permission_revoked_at end,
    email_status = excluded.email_status,
    computed_at = excluded.computed_at;

  -- Context modifiers (framework 4).
  with unit_activity as (
    select u.id, u.deadline,
      greatest(
        u.created_at,
        (select max(greatest(s.started_at, coalesce(s.ended_at, s.started_at)))
           from public.unit_sessions s where s.unit_id = u.id),
        (select max(p.updated_at) from public.unit_progress_steps p
           where p.unit_id = u.id and p.status <> 'pending'),
        (select max(i.created_at) from public.image_assets i
           where i.entity_type = 'unit' and i.entity_id = u.id),
        (select max(c.completed_at) from public.unit_guide_step_completions c where c.unit_id = u.id)
      ) as last_at
    from public.units u
    where u.user_id = v_user and u.status = 'active'
  ),
  focus as (
    select id, last_at from unit_activity order by last_at desc nulls last limit 1
  ),
  deadline as (
    select id from unit_activity
    where deadline between v_today and v_today + 3
    order by deadline limit 1
  ),
  linked_recipes as (
    select usr.recipe_id from public.unit_stage_recipes usr where usr.user_id = v_user
    union
    select ca.recipe_id from public.content_assignments ca
      where ca.user_id = v_user and ca.unit_id is not null and ca.recipe_id is not null
    union
    select g.primary_recipe_id from public.content_assignments ca
      join public.guides g on g.id = ca.guide_id
      where ca.user_id = v_user and ca.unit_id is not null and g.primary_recipe_id is not null
    union
    select gd.recipe_id from public.content_assignments ca
      join public.guide_decks gd on gd.guide_id = ca.guide_id
      where ca.user_id = v_user and ca.unit_id is not null
  ),
  unassigned_saves as (
    select sr.recipe_id, sr.created_at from public.saved_recipes sr
    where sr.user_id = v_user
      and not exists (select 1 from linked_recipes lr where lr.recipe_id = sr.recipe_id)
  ),
  social as (
    select x.recipe_id, x.created_at from (
      select rl.recipe_id, rl.created_at, rl.user_id from public.recipe_likes rl
      union all
      select sr.recipe_id, sr.created_at, sr.user_id from public.saved_recipes sr
    ) x
    join public.recipes r on r.id = x.recipe_id
    where r.user_id = v_user and x.user_id <> v_user
      and x.created_at > coalesce(v_prev_visit, p_now - interval '7 days')
  ),
  open_session as (
    select s.unit_id from public.unit_sessions s
    where s.user_id = v_user and s.ended_at is null and s.started_at > p_now - interval '2 hours'
    order by s.started_at desc limit 1
  ),
  last_ended as (
    select s.unit_id, s.ended_at from public.unit_sessions s
    where s.user_id = v_user and s.ended_at is not null and s.ended_at <= p_now
    order by s.ended_at desc limit 1
  )
  update public.user_lifecycle set
    active_unit_count = (select count(*) from unit_activity),
    stale_active_unit_count = (select count(*) from unit_activity where last_at < p_now - interval '3 days'),
    focus_unit_id = (select id from focus),
    focus_unit_last_activity_at = (select last_at from focus),
    deadline_within_72h = exists (select 1 from deadline),
    deadline_unit_id = (select id from deadline),
    draft_guide_count = (select count(*) from public.guides g
      where g.user_id = v_user and not g.is_auto and g.visibility = 'draft'),
    assigned_guide_count = (select count(*) from public.content_assignments ca
      where ca.user_id = v_user and ca.unit_id in (select id from unit_activity)),
    saved_guides_unassigned_count = (select count(*) from unassigned_saves),
    latest_unassigned_saved_recipe_id = (select recipe_id from unassigned_saves order by created_at desc limit 1),
    scheduled_session_within_24h = exists (select 1 from public.unit_scheduled_sessions ss
      where ss.user_id = v_user and ss.status = 'scheduled'
        and ss.scheduled_start_at between p_now and p_now + interval '24 hours'),
    recent_social_reward_count = (select count(*) from social),
    social_reward_recipe_id = (select recipe_id from social order by created_at desc limit 1),
    upcoming_event_24h = exists (select 1 from public.community_events e
      where e.is_published and e.event_date between v_today and v_today + 1),
    active_session_unit_id = (select unit_id from open_session),
    last_session_ended_at = (select ended_at from last_ended),
    last_session_unit_id = (select unit_id from last_ended)
  where user_id = v_user
  returning * into v_row;

  if v_prev.user_id is null or v_prev.lifecycle_state is distinct from v_row.lifecycle_state then
    insert into public.user_lifecycle_transitions (user_id, from_state, to_state, reactivated)
    values (v_user, v_prev.lifecycle_state, v_row.lifecycle_state,
            coalesce(v_row.lifecycle_state = 'active' and v_prev.lifecycle_state in ('at_risk', 'dormant'), false));
  end if;

  return v_row;
end;
$$;

revoke all on function public.engage_compute_lifecycle(uuid, timestamptz) from public, anon;
grant execute on function public.engage_compute_lifecycle(uuid, timestamptz) to authenticated, service_role;

-- Nightly / cron: recompute everyone. Service role only.
create or replace function public.engage_refresh_all(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'engage_refresh_all: service role only' using errcode = '42501';
  end if;
  for v_id in select id from auth.users loop
    perform public.engage_compute_lifecycle(v_id, p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.engage_refresh_all(timestamptz) from public, anon, authenticated;
grant execute on function public.engage_refresh_all(timestamptz) to service_role;

-- 6. Client-facing writers (each acts on auth.uid() only) -----------------------

-- Called once per app open (the client throttles it). Records the visit and
-- recomputes the lifecycle row when it is older than 10 minutes.
create or replace function public.engage_record_visit()
returns public.user_lifecycle
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_lifecycle;
begin
  if v_user is null then
    raise exception 'engage_record_visit: not signed in' using errcode = '42501';
  end if;

  insert into public.user_visits (user_id, visit_date)
  values (v_user, (now() at time zone 'utc')::date)
  on conflict (user_id, visit_date) do update
    set last_at = now(), hits = public.user_visits.hits + 1;

  select * into v_row from public.user_lifecycle where user_id = v_user;
  if v_row.user_id is null or v_row.computed_at < now() - interval '10 minutes' then
    v_row := public.engage_compute_lifecycle(v_user);
  end if;
  return v_row;
end;
$$;

revoke all on function public.engage_record_visit() from public, anon;
grant execute on function public.engage_record_visit() to authenticated;

create or replace function public.engage_record_notification_event(
  p_event_type text,
  p_source text,
  p_permission text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'engage_record_notification_event: not signed in' using errcode = '42501';
  end if;

  insert into public.notification_permission_events (user_id, event_type, source, permission)
  values (v_user, p_event_type, left(p_source, 60), p_permission);

  insert into public.user_lifecycle (user_id) values (v_user) on conflict (user_id) do nothing;

  update public.user_lifecycle set
    push_platform_permission = coalesce(p_permission, push_platform_permission),
    notification_soft_opt_in = case p_event_type
      when 'soft_prompt_shown' then case when notification_soft_opt_in = 'not_shown' then 'shown' else notification_soft_opt_in end
      when 'soft_prompt_enable' then 'enabled'
      when 'soft_prompt_skipped' then 'skipped'
      when 'soft_prompt_dismissed' then 'dismissed'
      else notification_soft_opt_in end,
    notification_soft_prompt_last_at = case when p_event_type like 'soft_prompt_%' then now() else notification_soft_prompt_last_at end,
    notification_soft_prompt_source = case when p_event_type like 'soft_prompt_%' then left(p_source, 60) else notification_soft_prompt_source end,
    notification_native_prompt_last_at = case when p_event_type = 'native_prompt_requested' then now() else notification_native_prompt_last_at end,
    notification_permission_granted_at = case when p_event_type = 'permission_granted' then now() else notification_permission_granted_at end,
    push_preference = case
      when p_event_type = 'permission_granted' then 'on'
      when p_event_type = 'subscription_removed' then 'off'
      else push_preference end,
    push_subscription_active = case
      when p_event_type = 'permission_granted' then true
      when p_event_type = 'subscription_removed' then false
      else push_subscription_active end,
    notification_permission_revoked_at = case
      when p_event_type = 'subscription_removed' then now() else notification_permission_revoked_at end,
    -- Skip in onboarding: 7-14 days (framework 6.1.1). Dismiss: 14 days (6.2).
    notification_opt_in_cooldown_until = case p_event_type
      when 'soft_prompt_skipped' then now() + interval '10 days'
      when 'soft_prompt_dismissed' then now() + interval '14 days'
      else notification_opt_in_cooldown_until end
  where user_id = v_user;
end;
$$;

revoke all on function public.engage_record_notification_event(text, text, text) from public, anon;
grant execute on function public.engage_record_notification_event(text, text, text) to authenticated;

-- In-app shown / clicked / dismissed. Push and email deliveries are written
-- by the server with the service role.
create or replace function public.engage_record_delivery(
  p_message_key text,
  p_status text,
  p_target_id uuid default null,
  p_is_preview boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_msg public.engagement_messages;
  v_state text;
  v_suppress interval;
begin
  if v_user is null then
    raise exception 'engage_record_delivery: not signed in' using errcode = '42501';
  end if;
  if p_status not in ('shown', 'clicked', 'dismissed') then
    raise exception 'engage_record_delivery: bad status' using errcode = '22023';
  end if;

  select * into v_msg from public.engagement_messages where key = p_message_key;
  if v_msg.key is null or v_msg.surface not in ('popup', 'topper') then
    raise exception 'engage_record_delivery: unknown in-app message' using errcode = '22023';
  end if;

  select lifecycle_state into v_state from public.user_lifecycle where user_id = v_user;

  insert into public.engagement_deliveries (
    user_id, message_key, channel, status, lifecycle_state, target_id, is_preview, dedup_key
  ) values (
    v_user, v_msg.key, v_msg.surface, p_status, v_state, p_target_id, p_is_preview,
    v_msg.key || ':' || coalesce(p_target_id::text, '-') || ':' || p_status || ':' ||
      to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24')
  ) on conflict (user_id, dedup_key) do nothing;

  -- Previews never change what the user would really see.
  if p_is_preview then return; end if;

  v_suppress := case
    when p_status = 'dismissed' and v_msg.message_family = 'notification_opt_in' then interval '14 days'
    when p_status = 'dismissed' then interval '6 days'
    when p_status = 'clicked' then interval '3 days'
    when v_msg.surface = 'popup' then interval '3 days'
    else null end;

  update public.user_lifecycle set
    last_popup_at = case when v_msg.surface = 'popup' and p_status = 'shown' then now() else last_popup_at end,
    last_topper_dismissed_at = case when v_msg.surface = 'topper' and p_status = 'dismissed' then now() else last_topper_dismissed_at end,
    message_family_last_at = message_family_last_at || jsonb_build_object(v_msg.message_family, now()),
    message_family_suppressed_until = case when v_suppress is null then message_family_suppressed_until
      else message_family_suppressed_until || jsonb_build_object(v_msg.message_family, now() + v_suppress) end,
    notification_opt_in_cooldown_until = case
      when v_msg.message_family = 'notification_opt_in' and p_status = 'dismissed' then now() + interval '14 days'
      else notification_opt_in_cooldown_until end
  where user_id = v_user;
end;
$$;

revoke all on function public.engage_record_delivery(text, text, uuid, boolean) from public, anon;
grant execute on function public.engage_record_delivery(text, text, uuid, boolean) to authenticated;

-- 7. V1 message catalog (framework section 10) ------------------------------------
-- All seeded as 'review': the admin page and ?engage_preview= show them;
-- no user sees or receives one until its status is set to 'live'.

insert into public.engagement_messages
  (key, v1_number, value_pillar, message_family, surface, lifecycle_states, priority,
   title, body, cta_label, cta_path, eligibility, hypothesis, success_event)
values
  ('stale_unit_push', 1, 'productivity', 'unit_continuity', 'push', array['active', 'at_risk'], 2,
   '{unit} is on the bench',
   '{unit} is already on the bench. You don''t need a full evening — even 20 minutes moves it forward.',
   'Start Painting', '/paint-mode?unit={unit_id}',
   'Active or At Risk, push on, an Active Unit with no session or progress for 3+ days.',
   'Does unfinished work create a meaningful return?',
   'Session start or Unit progress within 24h'),
  ('at_risk_return_push', 2, 'productivity', 'reactivation', 'push', array['at_risk'], 2,
   'One session is enough',
   'You don''t need to "get back into the hobby." You just need one session. {unit} is waiting exactly where you left it.',
   'Resume', '/units/{unit_id}',
   'At Risk for 7+ days with an Active Unit, push on.',
   'Can OG reactivate without an event?',
   'Return + Core Progress Action within 48h'),
  ('at_risk_return_email', 2, 'productivity', 'reactivation', 'email', array['at_risk'], 2,
   'Your bench is where you left it',
   'You don''t need to "get back into the hobby." You just need one session. {unit} is waiting exactly where you left it — notes, paints and last progress included.',
   'Resume {unit}', '/units/{unit_id}',
   'At Risk for 7+ days with an Active Unit, push off, email deliverable and marketing email allowed.',
   'Can OG reactivate without an event? (email fallback)',
   'Return + Core Progress Action within 48h'),
  ('session_next_step_popup', 3, 'productivity', 'session_next_step', 'popup', array['active'], 2,
   'Nice work.',
   'Before you close — what comes next? Ten seconds now saves the "where was I?" problem next time.',
   'Set Next Step', '/units/{unit_id}',
   'A painting Session ended in the last 30 minutes and no next-step popup was shown for it.',
   'Does setting the next step strengthen continuity?',
   'Next step set + return within 7d'),
  ('resume_unit_topper', 4, 'productivity', 'unit_continuity', 'topper', array['active', 'passive'], 2,
   'What''s next for {unit}?',
   'Continue exactly where you left off.',
   'Resume Work', '/units/{unit_id}',
   'Active or Passive, opens OG, focus Active Unit with no progress for 3+ days.',
   'Does reducing friction move browsing into work?',
   'Resume click → Core Progress Action'),
  ('saved_guide_assign_popup', 5, 'learning', 'guide_to_unit', 'popup', array['active', 'passive'], 2,
   'You saved the Guide. Now make it useful.',
   'Attach it to a Unit so it is ready when you start painting.',
   'Assign to Unit', '/recipes/{recipe_id}',
   'A saved Guide not linked to any Unit, and at least one Active Unit to attach it to.',
   'Can Learn → Do become a repeatable loop?',
   'Guide assigned to Unit'),
  ('assigned_guide_session_topper', 6, 'learning', 'guide_in_session', 'topper', array['active', 'passive', 'at_risk', 'dormant'], 2,
   'Your next step is ready',
   'The Guide on {unit} is open beside you — pick up the next card.',
   'Open Step', '/paint-mode?unit={unit_id}',
   'A painting Session is running on a Unit that has an assigned Guide.',
   'Does Guide context improve in-session utility?',
   'Open step / complete step'),
  ('social_reward_push', 7, 'community', 'social_reward', 'push', array['active', 'passive', 'at_risk', 'dormant'], 3,
   '{guide} received a new Save',
   'Someone just took something you made to their painting desk.',
   'View Guide', '/recipes/{recipe_id}',
   'Any activated user, push on, another painter saved or liked one of their Guides since their last visit.',
   'Does genuine community feedback bring users back?',
   'Open → content/community action'),
  ('push_opt_in_popup', 8, 'reachability', 'notification_opt_in', 'popup', array['active', 'passive'], 6,
   'Want OG to help you pick this up again?',
   'Get a reminder when a project stalls, a deadline is close, a saved Guide becomes relevant, or someone interacts with your work. No spam — you can change this anytime.',
   'Enable Notifications', '/settings',
   'Active or Passive, push off on this device and still requestable, has hobby context (Active Unit, saved or draft Guide), not in the 14-day opt-in cooldown.',
   'Can we grow push reach without annoying users?',
   'Notification permission granted'),
  ('push_opt_in_topper', 8, 'reachability', 'notification_opt_in', 'topper', array['active', 'passive'], 6,
   'Make your bench easier to return to',
   'Get reminders tied to the work already here.',
   'Enable Notifications', '/settings',
   'Passive with an Active Unit or Guide, push off and requestable, popup not shown this session, not in cooldown.',
   'Can we grow push reach without annoying users?',
   'Notification permission granted')
on conflict (key) do nothing;

-- 8. Backfill ----------------------------------------------------------------------
select public.engage_refresh_all();

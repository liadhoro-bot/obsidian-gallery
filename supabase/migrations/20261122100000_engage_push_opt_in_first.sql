-- ENGAGE, round 2: push opt-in first.
--
-- 1. notification_permission_events is folded into engagement_deliveries
--    (channel 'permission', status = the funnel step). Its rows move over and
--    the table is dropped.
-- 2. email_marketing_allowed comes from the product-updates box in
--    onboarding's terms step (user_terms_acceptances.product_updates_approved_at).
-- 3. Push opt-in becomes the top priority: a popup for Active users, a new
--    popup for everyone coming back (Passive / At Risk / Dormant / never
--    activated), and a one-line topper as the fallback. No hobby-context
--    requirement. "Not now" pauses the ask for 7 days (was 10-14).
-- 4. Push: the stale-unit push is for Active users; At Risk users get the
--    "one session is enough" push; a new Dormant push for once they're reachable.

-- 1. Funnel events -> engagement_deliveries ------------------------------------

alter table public.engagement_deliveries alter column message_key drop not null;
alter table public.engagement_deliveries add column if not exists source text;
alter table public.engagement_deliveries add column if not exists permission text;

alter table public.engagement_deliveries drop constraint if exists engagement_deliveries_channel_check;
alter table public.engagement_deliveries add constraint engagement_deliveries_channel_check
  check (channel in ('push', 'popup', 'topper', 'email', 'permission'));

alter table public.engagement_deliveries drop constraint if exists engagement_deliveries_status_check;
alter table public.engagement_deliveries add constraint engagement_deliveries_status_check
  check (status in (
    'shown', 'sent', 'clicked', 'dismissed', 'converted', 'failed',
    'soft_prompt_shown', 'soft_prompt_enable', 'soft_prompt_skipped', 'soft_prompt_dismissed',
    'native_prompt_requested', 'permission_granted', 'permission_denied',
    'subscription_removed', 'permission_observed'
  ));

alter table public.engagement_deliveries drop constraint if exists engagement_deliveries_permission_row_check;
alter table public.engagement_deliveries add constraint engagement_deliveries_permission_row_check
  check (
    (channel = 'permission' and source is not null)
    or (channel <> 'permission' and message_key is not null)
  );

create index if not exists engagement_deliveries_permission_idx
  on public.engagement_deliveries (status, created_at desc) where channel = 'permission';

insert into public.engagement_deliveries (user_id, message_key, channel, status, source, permission, dedup_key, created_at)
select e.user_id, null, 'permission', e.event_type, e.source, e.permission, 'perm:' || e.id::text, e.created_at
from public.notification_permission_events e
on conflict (user_id, dedup_key) do nothing;

drop table public.notification_permission_events;

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
  if p_event_type not in (
    'soft_prompt_shown', 'soft_prompt_enable', 'soft_prompt_skipped', 'soft_prompt_dismissed',
    'native_prompt_requested', 'permission_granted', 'permission_denied',
    'subscription_removed', 'permission_observed'
  ) then
    raise exception 'engage_record_notification_event: bad event' using errcode = '22023';
  end if;
  if p_permission is not null and p_permission not in ('granted', 'denied', 'prompt', 'unsupported', 'unknown') then
    raise exception 'engage_record_notification_event: bad permission' using errcode = '22023';
  end if;

  insert into public.user_lifecycle (user_id) values (v_user) on conflict (user_id) do nothing;

  insert into public.engagement_deliveries (user_id, channel, status, source, permission, lifecycle_state, dedup_key)
  select v_user, 'permission', p_event_type, left(p_source, 60), p_permission, ul.lifecycle_state,
         'perm:' || gen_random_uuid()::text
  from public.user_lifecycle ul where ul.user_id = v_user;

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
    -- Push opt-in comes first: "Not now" / skip pauses the ask for 7 days.
    notification_opt_in_cooldown_until = case
      when p_event_type in ('soft_prompt_skipped', 'soft_prompt_dismissed') then now() + interval '7 days'
      else notification_opt_in_cooldown_until end
  where user_id = v_user;
end;
$$;

revoke all on function public.engage_record_notification_event(text, text, text) from public, anon;
grant execute on function public.engage_record_notification_event(text, text, text) to authenticated;

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
    when p_status = 'dismissed' and v_msg.message_family = 'notification_opt_in' then interval '7 days'
    -- An unanswered opt-in (the peeker closed the app) doesn't pause the ask:
    -- the popup comes back after 24h and the one-line topper fills the gap.
    when v_msg.message_family = 'notification_opt_in' then null
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
      when v_msg.message_family = 'notification_opt_in' and p_status = 'dismissed' then now() + interval '7 days'
      else notification_opt_in_cooldown_until end
  where user_id = v_user;
end;
$$;

revoke all on function public.engage_record_delivery(text, text, uuid, boolean) from public, anon;
grant execute on function public.engage_record_delivery(text, text, uuid, boolean) to authenticated;

-- 2. Marketing email consent in the lifecycle computation -----------------------

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
    last_session_unit_id = (select unit_id from last_ended),
    -- Marketing email consent: the product-updates box in onboarding's terms step.
    -- The latest acceptance wins, so un-ticking it on a later version counts.
    email_marketing_allowed = coalesce((select t.product_updates_approved_at is not null
      from public.user_terms_acceptances t where t.user_id = v_user
      order by t.accepted_at desc limit 1), false)
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
-- 3. Push opt-in first -------------------------------------------------------------

update public.engagement_messages set
  lifecycle_states = array['active'],
  priority = 1,
  title = 'Let OG keep your bench warm',
  body = 'You''re painting — nice. Turn on notifications and OG will tap you on the shoulder when a unit has been sitting too long, a deadline is close, or another painter saves your work. Two a week at most. Never spam.',
  cta_label = 'Turn on notifications',
  eligibility = 'Active, push off on this device and still askable (not blocked, not in the 7-day pause after "Not now").',
  hypothesis = 'Will painters who are already engaged say yes to reminders?',
  updated_at = now()
where key = 'push_opt_in_popup';

update public.engagement_messages set
  lifecycle_states = array['active', 'passive', 'at_risk', 'dormant', 'unactivated'],
  priority = 1,
  title = 'Get a nudge when your bench goes quiet',
  body = 'One line strip (only the title and button show).',
  cta_label = 'Turn on',
  eligibility = 'Anyone with push off on this device and still askable, when the opt-in popup was shown in the last 24 hours (or this app session) and not answered.',
  hypothesis = 'Does a quiet second ask convert people who closed the popup?',
  updated_at = now()
where key = 'push_opt_in_topper';

insert into public.engagement_messages
  (key, v1_number, value_pillar, message_family, surface, lifecycle_states, priority,
   title, body, cta_label, cta_path, eligibility, hypothesis, success_event)
values
  ('push_opt_in_return_popup', 8, 'reachability', 'notification_opt_in', 'popup',
   array['passive', 'at_risk', 'dormant', 'unactivated'], 1,
   'That grey pile won''t paint itself',
   'You know the feeling — weeks slip by, the shelf of unpainted minis keeps staring back, and "I should really paint" turns into another month. Turn on notifications and OG will nudge you back to the bench with your next step ready: the unit you left, the guide you saved, a painter saving your work. Two a week at most.',
   'Nudge me back to painting', '/settings',
   'Anyone coming back who isn''t Active (Passive, At Risk, Dormant, never activated), push off on this device and still askable. Shown 2 seconds after the app opens, so quick peekers see it.',
   'Can we win back reach from people who drifted away, while they are here?',
   'Notification permission granted'),
  ('dormant_return_push', 2, 'productivity', 'reactivation', 'push', array['dormant'], 2,
   '{unit} is still on the bench',
   'It''s been a while. {unit} is right where you left it — notes, paints, next step. Twenty minutes is all it takes to get going again.',
   'Resume', '/units/{unit_id}',
   'Dormant (22+ days), push on, has an Active Unit. At most one push every 14 days.',
   'Can a single concrete reminder bring back someone who drifted away?',
   'Return + Core Progress Action within 72h')
on conflict (key) do nothing;

-- 4. Push: one message per state -----------------------------------------------------

update public.engagement_messages set
  lifecycle_states = array['active'],
  eligibility = 'Active, push on, an Active Unit with no session or progress for 3+ days.',
  updated_at = now()
where key = 'stale_unit_push';

update public.engagement_messages set
  eligibility = 'At Risk with an Active Unit and no progress for 7+ days, push on.',
  updated_at = now()
where key = 'at_risk_return_push';

update public.engagement_messages set
  lifecycle_states = array['at_risk', 'dormant'],
  eligibility = 'At Risk or Dormant, push off, has an Active Unit, ticked "product updates" in onboarding. Not sent automatically: the admin page lists them so you can write personally.',
  updated_at = now()
where key = 'at_risk_return_email';

-- 5. Recompute everyone so email consent shows up ------------------------------------
select public.engage_refresh_all();

-- 6. People coming back with push already on get the Resume strip too.
update public.engagement_messages set
  lifecycle_states = array['active', 'passive', 'at_risk', 'dormant'],
  eligibility = 'Opens OG with an Active Unit untouched for 3+ days (any state but never activated), no session running.',
  updated_at = now()
where key = 'resume_unit_topper';

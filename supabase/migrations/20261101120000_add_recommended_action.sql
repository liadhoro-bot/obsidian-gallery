-- Recommended Action card (docs/recommended-action/). Three private tables:
--
-- recommended_action_instances: one row per user per recommendation key
--   (ruleId:targetId:contextFingerprint), created the first time the user
--   sees, clicks, snoozes or dismisses it. Holds the state the engine must
--   respect next time: snooze, dismissal, ignored-impression cooldown, and
--   the click that completion is reconciled against.
-- recommended_action_events: append-only journal of everything that
--   happened to an instance. No names, notes or URLs in metadata.
-- recommended_action_preferences: the soft 14-day family penalty set by
--   "Not interested".
--
-- Every row belongs to its user; nobody else can read or change it.

create table if not exists public.recommended_action_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recommendation_key text not null check (char_length(recommendation_key) between 8 and 120),
  rule_id text not null check (rule_id ~ '^RA[0-9]{2}$'),
  rule_version integer not null default 1,
  ruleset_version text not null,
  family text not null check (family in ('painting', 'paints', 'guides', 'discovery')),
  action_type text not null,
  target_type text not null check (target_type in ('none', 'project', 'unit', 'guide', 'session')),
  target_id uuid,
  context_hash text not null,
  persona text,
  persona_source text,
  experiment_id text,
  variant text,
  status text not null default 'served'
    check (status in ('served', 'clicked', 'completed', 'dismissed', 'snoozed', 'expired')),
  first_impression_at timestamptz,
  last_impression_at timestamptz,
  ignored_impressions integer not null default 0,
  cooldown_until timestamptz,
  clicked_at timestamptz,
  completed_at timestamptz,
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recommendation_key)
);

create index if not exists recommended_action_instances_user_status_idx
  on public.recommended_action_instances (user_id, status);

create table if not exists public.recommended_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instance_id uuid references public.recommended_action_instances (id) on delete set null,
  recommendation_key text not null,
  event_type text not null check (event_type in (
    'impression', 'primary_click', 'show_another', 'snooze', 'dismiss',
    'goal_completed', 'expired', 'no_candidate'
  )),
  -- Repeats of the same event in one visit collapse onto one row.
  dedup_key text not null,
  visit_id text,
  client_ts timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, dedup_key)
);

create index if not exists recommended_action_events_user_created_idx
  on public.recommended_action_events (user_id, created_at desc);

create table if not exists public.recommended_action_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- { "guides": "2026-11-15T12:00:00Z", ... } family -> penalty end
  family_penalties jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.recommended_action_instances enable row level security;
alter table public.recommended_action_events enable row level security;
alter table public.recommended_action_preferences enable row level security;

drop policy if exists "recommended_action_instances_owner_all" on public.recommended_action_instances;
create policy "recommended_action_instances_owner_all"
on public.recommended_action_instances
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- The journal is append-only: owners can read and add, never edit or delete.
drop policy if exists "recommended_action_events_owner_select" on public.recommended_action_events;
create policy "recommended_action_events_owner_select"
on public.recommended_action_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recommended_action_events_owner_insert" on public.recommended_action_events;
create policy "recommended_action_events_owner_insert"
on public.recommended_action_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    instance_id is null
    or exists (
      select 1
      from public.recommended_action_instances i
      where i.id = instance_id
        and i.user_id = auth.uid()
    )
  )
);

drop policy if exists "recommended_action_preferences_owner_all" on public.recommended_action_preferences;
create policy "recommended_action_preferences_owner_all"
on public.recommended_action_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.recommended_action_instances to authenticated;
grant select, insert on public.recommended_action_events to authenticated;
grant select, insert, update, delete on public.recommended_action_preferences to authenticated;

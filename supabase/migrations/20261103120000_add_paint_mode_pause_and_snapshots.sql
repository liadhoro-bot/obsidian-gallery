-- Paint Mode: pausable timers and session snapshots.
--
-- A paused session keeps ended_at null. paused_at marks when the current
-- pause began; paused_seconds accumulates every finished pause, so the
-- painted time is (coalesce(paused_at, now) - started_at) - paused_seconds.
alter table public.unit_sessions
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

alter table public.unit_sessions
  drop constraint if exists unit_sessions_paused_seconds_nonnegative;
alter table public.unit_sessions
  add constraint unit_sessions_paused_seconds_nonnegative check (paused_seconds >= 0);

-- Photos taken with Take Snapshot remember the session they came from; the
-- Paint Mode progress gallery is every unit image with this set.
alter table public.image_assets
  add column if not exists unit_session_id uuid
    references public.unit_sessions (id) on delete set null;

create index if not exists image_assets_unit_session_id_idx
  on public.image_assets (unit_session_id)
  where unit_session_id is not null;

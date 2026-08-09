create extension if not exists pgcrypto;

create table if not exists public.unit_scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_start_at timestamptz not null,
  focus text not null default '',
  notify boolean not null default false,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_scheduled_sessions_status_check
    check (status in ('scheduled', 'cancelled', 'completed'))
);

alter table public.unit_scheduled_sessions enable row level security;

drop policy if exists "Users can select their scheduled unit sessions"
  on public.unit_scheduled_sessions;
create policy "Users can select their scheduled unit sessions"
on public.unit_scheduled_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their scheduled unit sessions"
  on public.unit_scheduled_sessions;
create policy "Users can insert their scheduled unit sessions"
on public.unit_scheduled_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their scheduled unit sessions"
  on public.unit_scheduled_sessions;
create policy "Users can update their scheduled unit sessions"
on public.unit_scheduled_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their scheduled unit sessions"
  on public.unit_scheduled_sessions;
create policy "Users can delete their scheduled unit sessions"
on public.unit_scheduled_sessions
for delete
using (auth.uid() = user_id);

create index if not exists unit_scheduled_sessions_user_start_idx
on public.unit_scheduled_sessions (user_id, scheduled_start_at);

create index if not exists unit_scheduled_sessions_unit_start_idx
on public.unit_scheduled_sessions (unit_id, scheduled_start_at);

create index if not exists unit_scheduled_sessions_user_status_start_idx
on public.unit_scheduled_sessions (user_id, status, scheduled_start_at);

drop trigger if exists unit_scheduled_sessions_set_updated_at
  on public.unit_scheduled_sessions;
create trigger unit_scheduled_sessions_set_updated_at
before update on public.unit_scheduled_sessions
for each row execute function public.set_updated_at();

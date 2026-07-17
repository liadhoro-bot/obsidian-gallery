alter table public.units
  add column if not exists completed_at timestamptz;

create index if not exists units_user_id_completed_at_idx
on public.units (user_id, completed_at)
where completed_at is not null;

create table if not exists public.share_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  share_type text not null,
  platform text not null,
  created_at timestamptz not null default now()
);

alter table public.share_events enable row level security;

drop policy if exists "Users can read their own share events" on public.share_events;
create policy "Users can read their own share events"
on public.share_events
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own share events" on public.share_events;
create policy "Users can insert their own share events"
on public.share_events
for insert
with check (auth.uid() = user_id);

create index if not exists share_events_user_entity_idx
on public.share_events (user_id, entity_type, entity_id, created_at desc);

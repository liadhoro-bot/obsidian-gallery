-- Log of admin push broadcasts sent from /admin/notifications.
-- Written and read only by the server with the service role, so RLS is on
-- with no policies.
create table if not exists public.push_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users (id) on delete set null,
  title text not null,
  body text not null,
  url text not null,
  devices integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  removed integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_broadcasts enable row level security;

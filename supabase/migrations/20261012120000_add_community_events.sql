-- Community events shown on the Community > Events tab.
-- Rows are entered by admins (Supabase table editor or service role);
-- signed-in users can read published events.

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),

  -- Venue-local calendar date and hours.
  event_date date not null,
  start_time time not null,
  end_time time,

  event_type text not null default 'other'
    check (event_type in (
      'workshop',
      'paint_night',
      'tournament',
      'league',
      'class',
      'meetup',
      'other'
    )),

  location_name text not null,
  address text,

  -- null = price not announced yet, 0 = free.
  price numeric(10, 2) check (price is null or price >= 0),
  currency char(3) not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),

  description text,

  contact_name text,
  contact_email text,
  contact_phone text,
  contact_url text,

  image_url text,
  is_featured boolean not null default false,
  is_published boolean not null default true,

  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint community_events_hours_order
    check (end_time is null or end_time > start_time)
);

create index if not exists community_events_upcoming_idx
  on public.community_events (event_date, start_time)
  where is_published;

drop trigger if exists community_events_set_updated_at on public.community_events;
create trigger community_events_set_updated_at
before update on public.community_events
for each row execute function public.set_updated_at();

alter table public.community_events enable row level security;

drop policy if exists "community_events_select_published" on public.community_events;
create policy "community_events_select_published"
on public.community_events
for select
to authenticated
using (is_published or public.current_user_is_global_admin());

drop policy if exists "community_events_admin_write" on public.community_events;
create policy "community_events_admin_write"
on public.community_events
for all
to authenticated
using (public.current_user_is_global_admin())
with check (public.current_user_is_global_admin());

grant select, insert, update, delete on public.community_events to authenticated;

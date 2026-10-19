-- Clicks from Community > Events to partner destinations: event pages,
-- store and event websites, registration pages, phone, email, social.
-- Written by /api/community/link-clicks; readable by global admins only.

create table if not exists public.partner_link_clicks (
  id bigint generated always as identity primary key,
  clicked_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('event', 'store')),
  -- community_events.id for events, the store slug for stores.
  target_id text not null,
  target_name text not null,
  link_kind text not null check (link_kind in (
    'event_page',
    'website',
    'registration',
    'phone',
    'email',
    'social'
  )),
  destination text not null,
  -- Where on the page the click happened, e.g. events_tab_featured.
  source text not null
);

create index if not exists partner_link_clicks_target_idx
  on public.partner_link_clicks (target_type, target_id, clicked_at desc);

alter table public.partner_link_clicks enable row level security;

drop policy if exists "partner_link_clicks_insert_own" on public.partner_link_clicks;
create policy "partner_link_clicks_insert_own"
on public.partner_link_clicks
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "partner_link_clicks_admin_read" on public.partner_link_clicks;
create policy "partner_link_clicks_admin_read"
on public.partner_link_clicks
for select
to authenticated
using (public.current_user_is_global_admin());

grant insert on public.partner_link_clicks to authenticated;
grant select on public.partner_link_clicks to authenticated;

-- Per partner and link type: all-time and last-30-day clicks and unique users.
create or replace view public.partner_link_click_summary
with (security_invoker = true)
as
select
  target_type,
  target_id,
  max(target_name) as target_name,
  link_kind,
  count(*) as clicks,
  count(distinct user_id) as unique_users,
  count(*) filter (where clicked_at >= now() - interval '30 days') as clicks_30d,
  count(distinct user_id) filter (where clicked_at >= now() - interval '30 days') as unique_users_30d,
  max(clicked_at) as last_clicked_at
from public.partner_link_clicks
group by target_type, target_id, link_kind;

grant select on public.partner_link_click_summary to authenticated;

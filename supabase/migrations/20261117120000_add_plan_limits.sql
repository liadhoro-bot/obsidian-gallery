-- Freemium: free-tier limits, editable without a deploy.
-- free_limit null = unlimited. Premium users (an active row in
-- subscriptions, or SUBSCRIPTION_BYPASS_EMAILS) are never limited.
-- The app caches these for 60 seconds (lib/plan/limits.ts).
create table if not exists public.plan_limits (
  limit_key text primary key,
  label text not null,
  free_limit integer check (free_limit is null or free_limit >= 0),
  description text,
  updated_at timestamptz not null default now()
);

alter table public.plan_limits enable row level security;

create policy "anyone signed in reads plan limits" on public.plan_limits
  for select to authenticated using (true);

-- no insert/update policies: edit rows in the Supabase dashboard or SQL editor

insert into public.plan_limits (limit_key, label, free_limit, description) values
  ('active_projects', 'active projects', null,
   'Projects that are empty or still have an unfinished unit.'),
  ('unfinished_units', 'unfinished units', null,
   'Units whose status is not complete.'),
  ('collection_paints', 'paints in your collection', null,
   'Paints marked as owned.')
on conflict (limit_key) do nothing;

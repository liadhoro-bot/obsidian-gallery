-- Organizer-curated copy for creator-voted contests (Top Hobby Guides): a short
-- description for each creator's contest page, and which of their guides
-- represents them on the Entries tab. The app reads it with the service role.
create table if not exists public.contest_creator_profiles (
  contest_id uuid not null references public.contests(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  description text check (char_length(description) <= 2000),
  cover_recipe_id uuid references public.recipes(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (contest_id, owner_user_id)
);

alter table public.contest_creator_profiles enable row level security;

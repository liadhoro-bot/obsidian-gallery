create extension if not exists pgcrypto;

create table if not exists public.onboarding_action_flows (
  name text primary key,
  title text not null,
  persona_label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_flow_actions (
  id uuid primary key default gen_random_uuid(),
  flow_name text not null references public.onboarding_action_flows(name) on delete cascade,
  action_key text not null,
  action_label text not null,
  action_order integer not null,
  breadcrumb text not null,
  ref_page text not null,
  ref_component text,
  created_at timestamptz not null default now(),
  unique (flow_name, action_key),
  unique (flow_name, action_order),
  constraint onboarding_flow_actions_order_check check (action_order between 1 and 3)
);

create table if not exists public.user_onboarding_flows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  flow_name text references public.onboarding_action_flows(name) on delete set null,
  goal_key text not null,
  experience_level text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_onboarding_flows_goal_key_check
    check (goal_key in ('paint_miniature', 'organize_hobby', 'create_content', 'look_around')),
  constraint user_onboarding_flows_experience_level_check
    check (
      experience_level is null or
      experience_level in ('just_starting', 'know_basics', 'experienced', 'professional')
    )
);

create table if not exists public.user_onboarding_action_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  flow_action_id uuid not null references public.onboarding_flow_actions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, flow_action_id)
);

alter table public.onboarding_action_flows enable row level security;
alter table public.onboarding_flow_actions enable row level security;
alter table public.user_onboarding_flows enable row level security;
alter table public.user_onboarding_action_completions enable row level security;

drop policy if exists "Authenticated users can read onboarding action flows"
  on public.onboarding_action_flows;
create policy "Authenticated users can read onboarding action flows"
  on public.onboarding_action_flows
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read onboarding flow actions"
  on public.onboarding_flow_actions;
create policy "Authenticated users can read onboarding flow actions"
  on public.onboarding_flow_actions
  for select
  to authenticated
  using (true);

drop policy if exists "Users can read their onboarding flow"
  on public.user_onboarding_flows;
create policy "Users can read their onboarding flow"
  on public.user_onboarding_flows
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their onboarding flow"
  on public.user_onboarding_flows;
create policy "Users can insert their onboarding flow"
  on public.user_onboarding_flows
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their onboarding flow"
  on public.user_onboarding_flows;
create policy "Users can update their onboarding flow"
  on public.user_onboarding_flows
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their onboarding action completions"
  on public.user_onboarding_action_completions;
create policy "Users can read their onboarding action completions"
  on public.user_onboarding_action_completions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their onboarding action completions"
  on public.user_onboarding_action_completions;
create policy "Users can insert their onboarding action completions"
  on public.user_onboarding_action_completions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their onboarding action completions"
  on public.user_onboarding_action_completions;
create policy "Users can delete their onboarding action completions"
  on public.user_onboarding_action_completions
  for delete
  using (auth.uid() = user_id);

create index if not exists onboarding_flow_actions_flow_order_idx
  on public.onboarding_flow_actions (flow_name, action_order);

create index if not exists user_onboarding_action_completions_user_idx
  on public.user_onboarding_action_completions (user_id);

insert into public.onboarding_action_flows
  (name, title, persona_label, description)
values
  (
    'paint_miniature',
    'Your first miniature',
    'Miniature painter',
    'A short checklist for getting a model into Obsidian Gallery and making painting progress.'
  ),
  (
    'organize_hobby',
    'Organize your hobby',
    'Hobby organizer',
    'A short checklist for setting up projects, units, and paint inventory.'
  ),
  (
    'create_content',
    'Share your work',
    'Content creator',
    'A short checklist for turning hobby progress into guides and shareable showcase moments.'
  )
on conflict (name) do update
set
  title = excluded.title,
  persona_label = excluded.persona_label,
  description = excluded.description;

insert into public.onboarding_flow_actions
  (flow_name, action_key, action_label, action_order, breadcrumb, ref_page, ref_component)
values
  (
    'paint_miniature',
    'add_or_photograph_miniature',
    'Add or photograph a miniature',
    1,
    'Unit Detail > Details > Gallery',
    '/units/new',
    'new-unit-form'
  ),
  (
    'paint_miniature',
    'choose_beginner_guide',
    'Choose a beginner guide',
    2,
    'Guides > Discover',
    '/recipes?tab=find',
    'guide-library'
  ),
  (
    'paint_miniature',
    'complete_first_painting_step',
    'Complete the first painting step',
    3,
    'Dashboard > Featured Unit',
    '/dashboard?tab=painting-table',
    'featured-unit'
  ),
  (
    'organize_hobby',
    'create_first_project',
    'Create your first project',
    1,
    'Projects > New Project',
    '/projects?tab=create',
    'create-project-form'
  ),
  (
    'organize_hobby',
    'add_unit_to_bench',
    'Add a unit to your bench',
    2,
    'Start Project / Unit > New Unit',
    '/units/new',
    'new-unit-form'
  ),
  (
    'organize_hobby',
    'mark_owned_paints',
    'Mark paints you own',
    3,
    'Paints > Collection',
    '/vault?tab=collection',
    'paint-vault'
  ),
  (
    'create_content',
    'create_custom_guide',
    'Create a custom guide',
    1,
    'Guides > Create',
    '/recipes?tab=custom',
    'create-guide-form'
  ),
  (
    'create_content',
    'add_showcase_photos',
    'Add showcase photos',
    2,
    'Unit Detail > Gallery',
    '/dashboard?tab=painting-table',
    'featured-unit'
  ),
  (
    'create_content',
    'share_completed_unit',
    'Share a completed unit',
    3,
    'Unit Detail > Share',
    '/dashboard?tab=painting-table',
    'featured-unit'
  )
on conflict (flow_name, action_key) do update
set
  action_label = excluded.action_label,
  action_order = excluded.action_order,
  breadcrumb = excluded.breadcrumb,
  ref_page = excluded.ref_page,
  ref_component = excluded.ref_component;
